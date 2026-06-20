-- ============================================================================
-- FIX: escalación de privilegios en `profiles`
--
-- Problema: la policy "profiles: editar propio" permite a cualquier usuario
-- autenticado hacer UPDATE sobre su propia fila sin restringir columnas.
-- Como `role` es una columna de esa misma tabla, cualquier usuario puede
-- hacer:
--   update profiles set role = 'super_admin' where id = auth.uid()
-- y la policy lo permite, porque solo valida que `id = auth.uid()`.
-- Como `my_role()` lee ese mismo campo, el usuario pasa a tener permisos de
-- super_admin en el resto de las tablas que dependen de my_role().
--
-- Fix: Postgres RLS no permite restringir columnas dentro de una misma
-- policy de UPDATE (el with_check aplica a la fila resultante, no a columnas
-- individuales). La forma correcta es usar un trigger que bloquee el cambio
-- de columnas sensibles (`role`, y de paso `id`) salvo que quien hace el
-- UPDATE sea super_admin o admin.
-- ============================================================================

create or replace function public.proteger_columnas_sensibles_profiles()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Si cambia el rol y quien ejecuta el UPDATE no es super_admin/admin, bloquear.
  if new.role is distinct from old.role then
    if public.my_role() not in ('super_admin', 'admin') then
      raise exception 'No tenés permisos para cambiar el rol';
    end if;
  end if;

  -- Nadie puede cambiar el id de un perfil (evita reasignar el perfil a otro usuario).
  if new.id is distinct from old.id then
    raise exception 'No se puede modificar el id de un perfil';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_columnas_sensibles_profiles on public.profiles;

create trigger trg_proteger_columnas_sensibles_profiles
  before update on public.profiles
  for each row
  execute function public.proteger_columnas_sensibles_profiles();

-- Nota: esta función es SECURITY DEFINER porque my_role() también lo es y
-- necesita poder leer profiles sin quedar atrapada en la misma RLS que
-- estamos validando.
