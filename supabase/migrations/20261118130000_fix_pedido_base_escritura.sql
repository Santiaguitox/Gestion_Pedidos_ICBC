-- ============================================================================
-- FIX: pedido_base volvía a aceptar escrituras de viewers
-- 2026-11-18 (corrige 20261118120000)
--
-- La migración anterior agregó "miembros pueden insertar/actualizar/eliminar
-- bases" (miembro activo, viewer incluido) asumiendo que las policies de
-- escritura de pedido_base eran las del repo ("autenticados pueden ..." con
-- USING true). En producción esas ya no existían: habían sido reemplazadas a
-- mano por "pedido_base: insertar / actualizar / eliminar", restringidas a
-- super_admin, admin y colaborador. Como las policies permisivas se combinan
-- con OR, las nuevas aflojaban esa restricción: un viewer podía escribir.
--
-- Qué hace:
--   1. Quita las 3 policies de escritura "miembros pueden ...".
--   2. Deja versionadas en el repo las policies reales de producción
--      ("pedido_base: ..."), creándolas SOLO si no existen — en producción
--      no cambia nada, y un entorno nuevo queda igual que producción.
-- La policy de lectura "miembros pueden leer bases" se mantiene.
-- ============================================================================

drop policy if exists "miembros pueden insertar bases" on public.pedido_base;
drop policy if exists "miembros pueden actualizar bases" on public.pedido_base;
drop policy if exists "miembros pueden eliminar bases" on public.pedido_base;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'pedido_base' and policyname = 'pedido_base: insertar') then
    create policy "pedido_base: insertar"
      on public.pedido_base for insert
      with check (public.my_role() = any (array['super_admin', 'admin', 'colaborador']));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'pedido_base' and policyname = 'pedido_base: actualizar') then
    create policy "pedido_base: actualizar"
      on public.pedido_base for update
      using (public.my_role() = any (array['super_admin', 'admin', 'colaborador']))
      with check (public.my_role() = any (array['super_admin', 'admin', 'colaborador']));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'pedido_base' and policyname = 'pedido_base: eliminar') then
    create policy "pedido_base: eliminar"
      on public.pedido_base for delete
      using (public.my_role() = any (array['super_admin', 'admin', 'colaborador']));
  end if;
end
$$;
