-- ============================================================================
-- NOTIFICACIONES AGRUPABLES — Fase 1 (modelo de datos)
--
-- Problema original: pasar un pedido de estado A a B desde EstadoPopover
-- son dos clicks -> dos UPDATEs -> dos notificaciones casi simultáneas
-- (una con el estado intermedio [A, B] y otra con el final [B]).
--
-- Diseño elegido (patrón de apps grandes tipo GitHub/Linear): cada evento
-- es una fila INDIVIDUAL e INMUTABLE, y el agrupamiento es 100% capa de
-- presentación. Nunca se pisa ni se borra un evento para agrupar:
--   - el historial queda íntegro,
--   - el realtime sigue siendo solo INSERT (no se rompe la suscripción
--     actual de NotificacionesContext),
--   - el mismo dato alimenta campanita, página de notificaciones y,
--     en Fase 2, el push de la PWA (tag = grupo_key para que el sistema
--     operativo colapse las notificaciones del mismo pedido).
--
-- Cambios:
--   1. Columnas nuevas en notificaciones:
--        tipo      — clasificación del evento (con CHECK constraint)
--        data      — payload estructurado (jsonb) para renderizar
--                    mensajes ricos y armar el texto de la push;
--                    `mensaje` queda como fallback plano
--        grupo_key — columna GENERADA: tipo + pedido (clave de
--                    agrupamiento, no puede desincronizarse)
--   2. Backfill de `tipo` sobre las filas existentes según el prefijo
--      del mensaje (los 4 patrones cubren todo salvo 2 pruebas manuales
--      del 2026-06-14, que quedan en el fallback 'sistema').
--   3. Índices para las consultas calientes del agrupado.
--   4. crear_notificacion extendida (tipo + data) y los 4 notif_*
--      actualizados para poblar las columnas nuevas.
--   5. FIX de bug latente: la tabla tiene RLS habilitado pero NO existía
--      policy de DELETE — todos los deletes del frontend (eliminar una /
--      varias / todas, y el prune automático a 50 en
--      NotificacionesContext.queryNotificaciones) eran no-ops silenciosos:
--      afectaban 0 filas y la notificación reaparecía al recargar.
--
-- Nota: las funciones incluyen SET search_path en la definición porque
-- CREATE OR REPLACE descarta el atributo aplicado por ALTER FUNCTION en
-- 20260701000000_fix_search_path_funciones.sql.
-- ============================================================================


-- ============================================================================
-- 1. COLUMNAS NUEVAS
-- ============================================================================

alter table public.notificaciones
  add column if not exists tipo text not null default 'sistema';

alter table public.notificaciones
  add column if not exists data jsonb;

alter table public.notificaciones
  drop constraint if exists notificaciones_tipo_check;

alter table public.notificaciones
  add constraint notificaciones_tipo_check
  check (tipo in ('cambio_estado', 'asignacion', 'aprobacion', 'vencimiento', 'sistema'));

-- Clave de agrupamiento como columna generada: siempre derivable de
-- tipo + pedido_id, imposible de desincronizar. Las notificaciones sin
-- pedido asociado agrupan bajo 'global' (aunque 'sistema' no se agrupa
-- en presentación — ver src/lib/notificaciones.js).
alter table public.notificaciones
  add column if not exists grupo_key text generated always as
    (tipo || ':' || coalesce(pedido_id::text, 'global')) stored;


-- ============================================================================
-- 2. BACKFILL de `tipo` según el prefijo del mensaje
--    (grupo_key se recalcula sola por ser columna generada)
-- ============================================================================

update public.notificaciones set tipo = 'cambio_estado'
  where tipo = 'sistema' and mensaje like '%cambió de estado:%';

update public.notificaciones set tipo = 'asignacion'
  where tipo = 'sistema' and mensaje like 'Te asignaron%';

update public.notificaciones set tipo = 'vencimiento'
  where tipo = 'sistema' and mensaje like 'Vence en%';

update public.notificaciones set tipo = 'aprobacion'
  where tipo = 'sistema' and mensaje like 'Pieza aprobada%';


-- ============================================================================
-- 3. ÍNDICES (hoy solo existe el de la PK)
-- ============================================================================

-- Consulta principal del contexto: últimas N del usuario.
create index if not exists idx_notificaciones_user_created
  on public.notificaciones (user_id, created_at desc);

-- Consulta caliente del agrupado y de "marcar grupo como leído":
-- no leídas del usuario por grupo. Índice parcial: chico y específico.
create index if not exists idx_notificaciones_user_grupo_no_leidas
  on public.notificaciones (user_id, grupo_key)
  where leida = false;


-- ============================================================================
-- 4. FIX RLS: policy de DELETE faltante
-- ============================================================================

drop policy if exists "notificaciones: eliminar propias" on public.notificaciones;
create policy "notificaciones: eliminar propias"
  on public.notificaciones for delete
  using (auth.uid() = user_id);


-- ============================================================================
-- 5. FUNCIONES
-- ============================================================================

-- crear_notificacion extendida con tipo + data. Se elimina la firma
-- vieja de 3 parámetros para no dejar dos overloads conviviendo (con
-- defaults en la nueva, una llamada de 3 argumentos sería ambigua).
drop function if exists public.crear_notificacion(uuid, uuid, text);

create or replace function public.crear_notificacion(
  p_user_id uuid,
  p_pedido_id uuid,
  p_mensaje text,
  p_tipo text default 'sistema',
  p_data jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notificaciones (user_id, pedido_id, mensaje, tipo, data)
  values (p_user_id, p_pedido_id, p_mensaje, p_tipo, p_data);
end;
$$;

-- Notifica a los asignados de un pedido cuando cambia su array de estados.
-- No notifica a quien hizo el cambio. Siempre INSERT (evento individual
-- e inmutable) — el colapso visual lo hace el frontend por grupo_key.
create or replace function public.notif_cambio_estado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_asignado record;
  v_estados_nuevos text;
begin
  if OLD.estados is distinct from NEW.estados then
    if array_length(NEW.estados, 1) > 0 then
      v_estados_nuevos := array_to_string(NEW.estados, ', ');
      for v_asignado in
        select user_id from public.pedido_asignados where pedido_id = NEW.id
      loop
        if v_asignado.user_id != auth.uid() then
          perform public.crear_notificacion(
            v_asignado.user_id,
            NEW.id,
            '"' || NEW.asunto || '" cambió de estado: ' || v_estados_nuevos,
            'cambio_estado',
            jsonb_build_object(
              'asunto', NEW.asunto,
              'estados', to_jsonb(NEW.estados),
              'estados_anteriores', to_jsonb(OLD.estados)
            )
          );
        end if;
      end loop;
    end if;
  end if;
  return NEW;
end;
$$;

-- Notifica al usuario asignado cuando se lo agrega a un pedido.
-- No notifica a quien hizo la asignación (ver 20260619000000).
create or replace function public.notif_asignacion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_asunto text;
begin
  if NEW.user_id = auth.uid() then
    return NEW;
  end if;

  select asunto into v_asunto from public.pedidos where id = NEW.pedido_id;
  perform public.crear_notificacion(
    NEW.user_id,
    NEW.pedido_id,
    'Te asignaron al pedido: ' || coalesce(v_asunto, 'sin título'),
    'asignacion',
    jsonb_build_object('asunto', v_asunto)
  );
  return NEW;
end;
$$;

-- Notifica a todos los asignados de un pedido cuando una pieza entregable
-- pasa a aprobado = true.
create or replace function public.notif_aprobacion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_asunto text;
  v_asignado record;
begin
  if OLD.aprobado = false and NEW.aprobado = true then
    select asunto into v_asunto from public.pedidos where id = NEW.pedido_id;
    for v_asignado in
      select user_id from public.pedido_asignados where pedido_id = NEW.pedido_id
    loop
      perform public.crear_notificacion(
        v_asignado.user_id,
        NEW.pedido_id,
        'Pieza aprobada en "' || v_asunto || '": ' || NEW.nombre_pieza,
        'aprobacion',
        jsonb_build_object('asunto', v_asunto, 'pieza', NEW.nombre_pieza)
      );
    end loop;
  end if;
  return NEW;
end;
$$;

-- Notifica vencimientos próximos. Sigue sin ejecutarse sola (pg_cron
-- pendiente de habilitar — Fase 3). El chequeo de "ya notifiqué hoy"
-- pasa de matchear el texto del mensaje a usar la columna tipo.
create or replace function public.notif_vencimientos()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido record;
  v_asignado record;
  v_dias int;
begin
  for v_pedido in
    select p.id, p.asunto, p.fecha_limite
    from public.pedidos p
    where p.deleted_at is null
      and p.fecha_limite is not null
      and not ('finalizado' = any(p.estados))
      and p.fecha_limite between current_date + 1 and current_date + 7
  loop
    v_dias := (v_pedido.fecha_limite - current_date);
    for v_asignado in
      select user_id from public.pedido_asignados where pedido_id = v_pedido.id
    loop
      if not exists (
        select 1 from public.notificaciones
        where pedido_id = v_pedido.id
          and user_id = v_asignado.user_id
          and tipo = 'vencimiento'
          and created_at::date = current_date
      ) then
        perform public.crear_notificacion(
          v_asignado.user_id,
          v_pedido.id,
          'Vence en ' || v_dias || ' día' || case when v_dias = 1 then '' else 's' end || ': ' || v_pedido.asunto,
          'vencimiento',
          jsonb_build_object('asunto', v_pedido.asunto, 'dias', v_dias)
        );
      end if;
    end loop;
  end loop;
end;
$$;
