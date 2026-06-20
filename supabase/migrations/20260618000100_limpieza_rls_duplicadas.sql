-- ============================================================================
-- FIX: hueco de RLS en `entregable` + limpieza de policies duplicadas
--
-- 1) entregable: existía una policy "entregable: todos pueden modificar"
--    (ALL, qual = authenticated) que permitía a CUALQUIER usuario autenticado
--    insertar/actualizar/eliminar piezas entregables, sin importar el rol.
--    Como las policies de Postgres RLS se combinan con OR, esta policy
--    permisiva anulaba en la práctica las otras 4 policies más restrictivas
--    de la misma tabla (insertar, actualizar no aprobados, eliminar, ver).
--    Resultado: un viewer podía borrar piezas ya aprobadas.
--
-- 2) pedido_asignados: dos policies ALL redundantes
--    ("asignados: admin y colaborador modifican" y "asignados: modificar").
--    La segunda ya cubre el mismo caso (y de forma más completa, incluyendo
--    super_admin). Se elimina la primera para no tener dos policies haciendo
--    lo mismo con distinto alcance.
--
-- 3) subtareas: dos policies ALL idénticas en la práctica
--    ("subtareas: modificar" y "subtareas: todos menos viewer modifican").
--    Se deja una sola.
-- ============================================================================

-- 1) entregable: eliminar la policy permisiva que anulaba a las demás.
drop policy if exists "entregable: todos pueden modificar" on public.entregable;

-- 2) pedido_asignados: eliminar la policy redundante (más estrecha y con
--    nombre que no refleja lo que permite).
drop policy if exists "asignados: admin y colaborador modifican" on public.pedido_asignados;

-- 3) subtareas: eliminar el duplicado, dejar "subtareas: modificar" que
--    además tiene with_check (más correcta que la que solo tiene qual).
drop policy if exists "subtareas: todos menos viewer modifican" on public.subtareas;
