-- ============================================================================
-- Alertas de seguridad a super_admin (campanita + push de la PWA)
-- 2026-11-18
--
-- Reusa la infraestructura de notificaciones que ya existe: cada alerta es
-- una fila en `notificaciones` (tipo 'sistema', sin pedido) para cada
-- super_admin activo. El trigger trg_notif_despachar_push la entrega como
-- Web Push al celular; en la app aparece en la campanita y en
-- /notificaciones. No agrega servicios ni credenciales.
--
-- QUÉ AVISA
--   1. Una cuenta que NO fue activada por invitación confirma su mail
--      (el atacante tiene que confirmar el mail para poder entrar).
--   2. Una cuenta inactiva inicia sesión.
--   3. Alguien pasa a admin o super_admin.
--   4. Se activa a mano una cuenta que no tiene invitación.
--
-- POR QUÉ NO AVISA "SE CREÓ UNA CUENTA" APENAS SE REGISTRA
--   GoTrue inserta el usuario y recién ~10 ms después le setea invited_at
--   (se ve en auth.users: invited_at > created_at por milisegundos). En el
--   instante del INSERT, una invitación legítima y un registro público son
--   idénticos, así que avisar ahí daría una falsa alarma por cada invitación.
--   El criterio estable es el perfil: un perfil legítimo queda activo apenas
--   termina invite-user; uno que sigue inactivo cuando confirma el mail o
--   inicia sesión no vino de una invitación.
--
-- DISEÑO
--   * Best-effort: todo va con EXCEPTION WHEN OTHERS. Un error de alerta
--     jamás puede romper un login ni una invitación (los triggers están
--     sobre auth.users).
--   * Antirrebote: el mismo evento sobre la misma cuenta se avisa una vez
--     cada 10 minutos.
--   * notificar_seguridad() NO es invocable por la API (REVOKE): si lo
--     fuera, cualquiera podría mandar pushes con texto propio al equipo.
--   * Nota: los intentos bloqueados por RLS/triggers no se pueden avisar
--     desde la base (la transacción se revierte junto con el aviso).
--
-- Si "supabase db push" falla por permisos al crear triggers sobre
-- auth.users, correr el archivo completo desde el SQL Editor del dashboard.
-- ============================================================================


-- ─── Helper: crear la alerta para cada super_admin activo ───────────────────
create or replace function public.notificar_seguridad(
  p_mensaje text,
  p_evento  text,
  p_cuenta  uuid,
  p_email   text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Antirrebote: mismo evento + misma cuenta en los últimos 10 minutos.
  if exists (
    select 1 from public.notificaciones n
    where n.data->>'categoria' = 'seguridad'
      and n.data->>'evento' = p_evento
      and n.data->>'cuenta_id' = p_cuenta::text
      and n.created_at > now() - interval '10 minutes'
  ) then
    return;
  end if;

  insert into public.notificaciones (user_id, pedido_id, mensaje, tipo, data)
  select
    p.id,
    null,
    p_mensaje,
    'sistema',
    jsonb_build_object(
      'categoria', 'seguridad',
      'evento',    p_evento,
      'cuenta_id', p_cuenta,
      'email',     p_email
    )
  from public.profiles p
  where p.role = 'super_admin' and p.activo;
exception when others then
  -- Best-effort: nunca romper la operación que disparó la alerta.
  null;
end;
$$;

revoke all on function public.notificar_seguridad(text, text, uuid, text) from public, anon, authenticated;


-- ─── Triggers sobre auth.users: confirmación de mail / inicio de sesión ─────
create or replace function public.alerta_cuenta_no_invitada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activo boolean;
begin
  select p.activo into v_activo from public.profiles p where p.id = new.id;

  -- Sin perfil o con perfil activo: cuenta legítima, nada que avisar.
  if v_activo is distinct from false then
    return new;
  end if;

  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    perform public.notificar_seguridad(
      'Alerta de seguridad: la cuenta inactiva ' || coalesce(new.email, '(sin mail)') || ' inició sesión.',
      'login_cuenta_inactiva', new.id, new.email
    );
  elsif new.email_confirmed_at is distinct from old.email_confirmed_at then
    perform public.notificar_seguridad(
      'Alerta de seguridad: ' || coalesce(new.email, '(sin mail)') || ' se registró sin invitación y confirmó su mail.',
      'registro_sin_invitacion', new.id, new.email
    );
  end if;

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_alerta_cuenta_no_invitada on auth.users;
create trigger trg_alerta_cuenta_no_invitada
  after update of email_confirmed_at, last_sign_in_at on auth.users
  for each row
  when (
    new.email_confirmed_at is distinct from old.email_confirmed_at
    or new.last_sign_in_at is distinct from old.last_sign_in_at
  )
  execute function public.alerta_cuenta_no_invitada();


-- ─── Trigger sobre profiles: nuevos admins / activación manual ──────────────
create or replace function public.alerta_cambio_privilegios()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitada boolean;
begin
  if new.role is distinct from old.role and new.role in ('admin', 'super_admin') then
    perform public.notificar_seguridad(
      'Alerta de seguridad: ' || coalesce(new.email, new.id::text) || ' ahora tiene rol ' || new.role || '.',
      'rol_privilegiado_' || new.role, new.id, new.email
    );
  end if;

  -- Activación de una cuenta que nunca pasó por una invitación.
  if new.activo and not old.activo then
    select (u.invited_at is not null) into v_invitada from auth.users u where u.id = new.id;
    if v_invitada is distinct from true then
      perform public.notificar_seguridad(
        'Alerta de seguridad: se activó la cuenta ' || coalesce(new.email, new.id::text) || ', que no tiene invitación.',
        'activacion_sin_invitacion', new.id, new.email
      );
    end if;
  end if;

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_alerta_cambio_privilegios on public.profiles;
create trigger trg_alerta_cambio_privilegios
  after update of role, activo on public.profiles
  for each row
  execute function public.alerta_cambio_privilegios();
