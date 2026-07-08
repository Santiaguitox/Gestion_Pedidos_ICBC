-- ============================================================================
-- WEB PUSH — Fase 2 (suscripciones + despacho)
--
-- Circuito completo:
--   navegador ── suscripción Web Push (VAPID) ──> push_suscripciones
--   INSERT en notificaciones ── trigger ── pg_net (async) ──> Edge Function
--   enviar-push ── web-push ──> servicio de push del navegador ──> celu
--
-- El colapso en el teléfono lo hace el sistema operativo: la Edge
-- Function manda cada push con `tag = grupo_key`, así dos cambios de
-- estado del mismo pedido se ven como UNA notificación (siempre con el
-- último estado), igual que el agrupado in-app de la Fase 1.
--
-- Seguridad del despacho: el trigger manda SOLO el id de la
-- notificación; la Edge Function re-consulta la fila con service role
-- y usa únicamente datos de la base. Como el endpoint es invocable con
-- la anon key (pública), esto garantiza que nadie pueda fabricar
-- contenido de push ni dirigirlo a otro usuario.
--
-- Esta migración es SEGURA de aplicar antes de configurar el resto:
-- si los secretos del Vault no existen todavía (project_url /
-- anon_key), el trigger es un no-op silencioso y la app sigue igual
-- que en Fase 1. Pasos de configuración: ver el README de la entrega.
-- ============================================================================


-- ============================================================================
-- 1. EXTENSIÓN pg_net (HTTP asíncrono desde la base)
-- ============================================================================

create extension if not exists pg_net;


-- ============================================================================
-- 2. TABLA push_suscripciones
--    Un usuario puede tener varias (celu + desktop + tablet). El
--    endpoint es único a nivel global: si otro usuario inicia sesión
--    en el mismo navegador y activa push, la fila se reasigna (upsert
--    por endpoint desde el frontend).
-- ============================================================================

create table if not exists public.push_suscripciones (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_suscripciones_user
  on public.push_suscripciones (user_id);

alter table public.push_suscripciones enable row level security;

drop policy if exists "push: ver propias" on public.push_suscripciones;
create policy "push: ver propias"
  on public.push_suscripciones for select
  using (auth.uid() = user_id);

drop policy if exists "push: crear propias" on public.push_suscripciones;
create policy "push: crear propias"
  on public.push_suscripciones for insert
  with check (auth.uid() = user_id);

-- El upsert por endpoint necesita UPDATE (reasignación del dispositivo
-- a quien esté logueado): se permite tomar una fila existente siempre
-- que el resultado quede a nombre propio.
drop policy if exists "push: actualizar a nombre propio" on public.push_suscripciones;
create policy "push: actualizar a nombre propio"
  on public.push_suscripciones for update
  using (true)
  with check (auth.uid() = user_id);

drop policy if exists "push: eliminar propias" on public.push_suscripciones;
create policy "push: eliminar propias"
  on public.push_suscripciones for delete
  using (auth.uid() = user_id);


-- ============================================================================
-- 3. DESPACHO: trigger AFTER INSERT sobre notificaciones -> Edge Function
--    vía pg_net (asíncrono: no bloquea ni puede romper la transacción
--    del cambio de estado / asignación / aprobación).
-- ============================================================================

create or replace function public.notif_despachar_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url text;
  v_key text;
begin
  -- Config leída del Vault (ver README: vault.create_secret).
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'anon_key';

  -- Sin configurar -> no-op: la Fase 2 se puede desplegar por partes.
  if v_url is null or v_key is null then
    return NEW;
  end if;

  perform net.http_post(
    url := v_url || '/functions/v1/enviar-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object('notificacion_id', NEW.id),
    timeout_milliseconds := 5000
  );
  return NEW;

exception when others then
  -- El push es best-effort: cualquier error acá jamás debe voltear el
  -- INSERT de la notificación (que a su vez corre dentro del UPDATE
  -- del pedido). La notificación in-app siempre llega igual.
  return NEW;
end;
$$;

drop trigger if exists trg_notif_despachar_push on public.notificaciones;
create trigger trg_notif_despachar_push
  after insert on public.notificaciones
  for each row execute function public.notif_despachar_push();
