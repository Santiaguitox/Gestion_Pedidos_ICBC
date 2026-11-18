-- ============================================================================
-- Cuentas sin invitación: sin acceso a nada (defensa en profundidad)
-- 2026-11-18
--
-- INCIDENTE: con el registro público de Supabase Auth abierto, alguien llamó
-- directo a /auth/v1/signup con la anon key (pública, va en el bundle del
-- front), confirmó el mail y obtuvo un JWT válido. handle_new_user() le creó
-- un perfil con el rol por defecto ('colaborador') y, además, casi todas las
-- policies de LECTURA solo exigían auth.role() = 'authenticated', así que esa
-- cuenta podía leer pedidos, comentarios, perfiles, etc. por la API.
-- El registro público ya se cerró desde el dashboard; esta migración deja la
-- base segura aunque se reabriera o apareciera otro camino de alta.
--
-- QUÉ HACE
--   1. profiles.activo: una cuenta solo "cuenta como miembro" si fue
--      invitada. Las existentes se marcan activas (backfill único).
--   2. my_role() devuelve NULL si el perfil no está activo. Como casi todas
--      las policies y RPCs se apoyan en my_role(), una cuenta inactiva queda
--      sin permisos en todos lados de un solo golpe.
--   3. handle_new_user(): perfil nuevo con rol 'viewer' y activo = false,
--      salvo que auth.users.invited_at venga seteado (alta por invitación).
--   4. proteger_columnas_sensibles_profiles(): además de role, protege
--      'activo', y cierra un hueco latente: con my_role() NULL, el viejo
--      "NULL not in (...)" daba NULL (no true) y NO bloqueaba el cambio.
--      Ahora un usuario real sin rol de admin no puede tocarlos; el service
--      role y el SQL editor (auth.uid() NULL) siguen pudiendo.
--   5. Policies de lectura: de auth.role() = 'authenticated' a
--      my_role() IS NOT NULL (miembro activo, viewer incluido).
--   6. pedido_base: sus 4 policies eran USING (true) para cualquier
--      autenticado. Ahora exigen miembro activo (no se endurece por rol de
--      escritura para no cambiar lo que hoy puede hacer un viewer).
--   7. notificaciones: INSERT WITH CHECK (true) permitía a cualquier cuenta
--      mandar notificaciones (y push) con texto propio a cualquier usuario.
--      Ahora solo super_admin / admin / colaborador.
--   8. pedidos: INSERT exige created_by = auth.uid() (antes se podía poner
--      el uuid de otra persona como creador).
--   9. profiles.role: DEFAULT 'viewer' (antes 'colaborador').
--
-- ORDEN DE DEPLOY
--   a) Correr esta migración.
--   b) Deployar las Edge Functions invite-user y la carpeta _shared (el
--      resto de las funciones que importan _shared: delete-user,
--      reset-user-password, escribir-sheet). invite-user pasa a setear
--      activo = true al invitar.
--   No invitar usuarios entre (a) y (b): quedarían inactivos hasta que se
--   les ponga activo = true a mano.
--
-- ANTES DE CORRERLA
--   Revisar que todos los perfiles actuales sean legítimos, porque el
--   backfill los activa a todos:
--     select p.id, p.email, p.role, p.created_at, u.invited_at
--     from profiles p join auth.users u on u.id = p.id
--     order by p.created_at desc;
--
-- ROLLBACK (si algo sale mal): ver el bloque comentado al final.
-- ============================================================================


-- ─── 1. Columna profiles.activo (con backfill SOLO la primera vez) ──────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'activo'
  ) then
    alter table public.profiles add column activo boolean not null default false;
    -- Backfill único: todos los perfiles que existen HOY son cuentas legítimas.
    update public.profiles set activo = true;
  end if;
end
$$;

-- ─── 9. Rol por defecto: el mínimo ──────────────────────────────────────────
alter table public.profiles alter column role set default 'viewer';


-- ─── 2. my_role(): NULL para cuentas no activas ─────────────────────────────
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid() and activo
$$;


-- ─── 3. handle_new_user(): viewer + inactivo salvo invitación ───────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, email, role, activo)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    'viewer',
    new.invited_at is not null
  );
  return new;
end;
$$;


-- ─── 4. Trigger de columnas sensibles de profiles ───────────────────────────
create or replace function public.proteger_columnas_sensibles_profiles()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- auth.uid() NULL = service role / SQL editor / migraciones: permitido.
  -- Un usuario real que no sea admin/super_admin (incluye cuentas sin rol
  -- activo, para las que my_role() es NULL) no puede tocar role ni activo.
  if auth.uid() is not null
     and coalesce(public.my_role(), '') not in ('super_admin', 'admin') then

    if new.role is distinct from old.role then
      raise exception 'No tenés permisos para cambiar el rol';
    end if;

    if new.activo is distinct from old.activo then
      raise exception 'No tenés permisos para cambiar el estado de la cuenta';
    end if;
  end if;

  if new.id is distinct from old.id then
    raise exception 'No se puede modificar el id de un perfil';
  end if;

  return new;
end;
$$;


-- ─── 5. Policies de lectura: miembro activo en vez de "cualquier autenticado"
drop policy if exists "actividad: todos pueden ver" on public.actividad;
create policy "actividad: todos pueden ver"
  on public.actividad for select
  using (public.my_role() is not null);

drop policy if exists "entregable: ver todos" on public.entregable;
create policy "entregable: ver todos"
  on public.entregable for select
  using (public.my_role() is not null);

drop policy if exists "estados: todos pueden ver" on public.estados;
create policy "estados: todos pueden ver"
  on public.estados for select
  using (public.my_role() is not null);

drop policy if exists "instancias: todos pueden ver" on public.instancias;
create policy "instancias: todos pueden ver"
  on public.instancias for select
  using (public.my_role() is not null);

drop policy if exists "asignados: ver todos" on public.pedido_asignados;
create policy "asignados: ver todos"
  on public.pedido_asignados for select
  using (public.my_role() is not null);

drop policy if exists "subtareas: ver todos" on public.subtareas;
create policy "subtareas: ver todos"
  on public.subtareas for select
  using (public.my_role() is not null);

drop policy if exists "tipos: todos pueden ver" on public.tipos;
create policy "tipos: todos pueden ver"
  on public.tipos for select
  using (public.my_role() is not null);

-- pedidos: misma regla que dejó 20260717000002 (solo super_admin ve la
-- papelera), sumando el requisito de miembro activo.
drop policy if exists "pedidos: ver activos" on public.pedidos;
create policy "pedidos: ver activos"
  on public.pedidos for select
  using (
    public.my_role() is not null
    and (deleted_at is null or public.my_role() = 'super_admin')
  );

-- profiles: cada cuenta puede leer SU propia fila (el front la consulta
-- apenas se loguea), pero el resto de los perfiles solo los ve un miembro.
drop policy if exists "profiles: ver todos" on public.profiles;
create policy "profiles: ver todos"
  on public.profiles for select
  using (auth.uid() = id or public.my_role() is not null);

-- profiles: editar el propio perfil, solo si la cuenta está activa.
drop policy if exists "profiles: editar propio" on public.profiles;
create policy "profiles: editar propio"
  on public.profiles for update
  using (auth.uid() = id and public.my_role() is not null);


-- ─── 6. pedido_base: era USING (true) para cualquier autenticado ────────────
drop policy if exists "autenticados pueden leer bases" on public.pedido_base;
drop policy if exists "miembros pueden leer bases" on public.pedido_base;
create policy "miembros pueden leer bases"
  on public.pedido_base for select
  to authenticated
  using (public.my_role() is not null);

drop policy if exists "autenticados pueden insertar bases" on public.pedido_base;
drop policy if exists "miembros pueden insertar bases" on public.pedido_base;
create policy "miembros pueden insertar bases"
  on public.pedido_base for insert
  to authenticated
  with check (public.my_role() is not null);

drop policy if exists "autenticados pueden actualizar bases" on public.pedido_base;
drop policy if exists "miembros pueden actualizar bases" on public.pedido_base;
create policy "miembros pueden actualizar bases"
  on public.pedido_base for update
  to authenticated
  using (public.my_role() is not null);

drop policy if exists "autenticados pueden eliminar bases" on public.pedido_base;
drop policy if exists "miembros pueden eliminar bases" on public.pedido_base;
create policy "miembros pueden eliminar bases"
  on public.pedido_base for delete
  to authenticated
  using (public.my_role() is not null);


-- ─── 7. notificaciones: no más INSERT libre ─────────────────────────────────
-- Los triggers de notificaciones son SECURITY DEFINER y no pasan por esta
-- policy. El único insert desde el front es el aviso de asignación de
-- subtarea (PedidoDetalle.jsx), que lo hace un rol que ya puede editar.
drop policy if exists "notificaciones: sistema puede insertar" on public.notificaciones;
drop policy if exists "notificaciones: roles de equipo pueden insertar" on public.notificaciones;
create policy "notificaciones: roles de equipo pueden insertar"
  on public.notificaciones for insert
  with check (public.my_role() = any (array['super_admin', 'admin', 'colaborador']));


-- ─── 8. pedidos: el creador es siempre quien inserta ────────────────────────
drop policy if exists "pedidos: insertar" on public.pedidos;
create policy "pedidos: insertar"
  on public.pedidos for insert
  with check (
    public.my_role() = any (array['super_admin', 'admin', 'colaborador'])
    and created_by = auth.uid()
  );


-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN (correr a mano)
--   -- 1) Ningún perfil legítimo quedó inactivo:
--   select id, email, role, activo from profiles where not activo;
--   -- 2) Alta sin invitación → perfil inactivo:
--   select p.email, p.activo, u.invited_at
--   from profiles p join auth.users u on u.id = p.id
--   order by p.created_at desc limit 10;
-- ============================================================================

-- ROLLBACK (solo si hace falta volver atrás):
--   alter table public.profiles alter column role set default 'colaborador';
--   create or replace function public.my_role() returns text language sql stable
--     security definer set search_path = public, pg_temp
--     as $f$ select role from public.profiles where id = auth.uid() $f$;
--   -- y volver a correr las policies de 20260717000002 (pedidos: ver activos)
--   -- y del baseline para el resto de las tablas.
