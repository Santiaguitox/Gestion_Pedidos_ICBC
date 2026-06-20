-- ============================================================================
-- FIX: admin no podía eliminar (soft-delete) pedidos
--
-- Síntoma: al hacer soft-delete (UPDATE pedidos SET deleted_at = now()),
-- un usuario admin recibía: "new row violates row-level security policy".
--
-- Causa real (más sutil de lo que parece a primera vista):
-- Postgres exige que la fila resultante de un UPDATE sea visible bajo las
-- policies de SELECT, no solo bajo el with_check de la policy de UPDATE.
-- La policy de SELECT ("pedidos: ver activos") solo muestra filas con
-- deleted_at IS NULL a quien no sea super_admin. Apenas el UPDATE escribe
-- deleted_at, la fila deja de ser "visible" para admin bajo esa policy de
-- SELECT, y todo el UPDATE se rechaza — aunque la policy de UPDATE en sí
-- lo hubiera permitido.
--
-- Decisión de producto: admin SI puede eliminar (mandar a papelera) un
-- pedido. Que NO pueda ver/restaurar la Papelera ya está resuelto en el
-- frontend (ProtectedRoute solo deja entrar a super_admin a esa ruta).
-- Para que el UPDATE se pueda completar, admin necesita poder "ver" (a
-- nivel de base) filas con deleted_at NOT NULL, igual que super_admin.
--
-- Fix: 1) agregar with_check explícito a la policy de UPDATE (separa
-- "puedo escribir" de "puedo ver el resultado"); 2) ampliar la policy de
-- SELECT para que admin también vea filas eliminadas a nivel de base
-- (la Papelera de la UI sigue restringida a super_admin por su cuenta).
-- ============================================================================

drop policy if exists "pedidos: admin y super_admin actualizan" on public.pedidos;

create policy "pedidos: admin y super_admin actualizan"
  on public.pedidos
  for update
  using (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'colaborador'::text]))
  with check (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'colaborador'::text]));

drop policy if exists "pedidos: ver activos" on public.pedidos;

create policy "pedidos: ver activos"
  on public.pedidos
  for select
  using (
    (auth.role() = 'authenticated'::text)
    and (
      (deleted_at is null)
      or (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text]))
    )
  );

