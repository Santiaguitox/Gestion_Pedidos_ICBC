-- ============================================================================
-- FIX: admin podía leer pedidos de la papelera directamente contra la
-- base, aunque no tenga acceso a la página Papelera
--
-- Decisión de negocio (confirmada): admin puede mandar un pedido a la
-- papelera (ver trigger de 20260717000000), pero no debe poder verla,
-- restaurar pedidos, ni eliminarlos definitivamente — ni siquiera
-- consultando la tabla directo (sin pasar por la pantalla). Antes de
-- este fix, la policy de SELECT dejaba ver filas con deleted_at NOT NULL
-- tanto a super_admin como a admin (era necesario en el pasado para
-- otras operaciones; se confirmó que hoy ningún flujo de admin depende
-- de esto: la única pantalla que agrega tags incluyendo la papelera,
-- SeccionTags en Configuracion.jsx, ya está gateada a super_admin en la
-- UI). Con este cambio, admin deja de poder ver esas filas incluso vía
-- API directa — la protección deja de depender únicamente de que la UI
-- oculte el botón y la ruta.
--
-- Fix: sacar 'admin' de la excepción de la policy de SELECT — solo
-- super_admin puede ver filas con deleted_at NOT NULL.
-- ============================================================================

DROP POLICY IF EXISTS "pedidos: ver activos" ON public.pedidos;
CREATE POLICY "pedidos: ver activos"
  ON public.pedidos FOR SELECT
  USING (
    (auth.role() = 'authenticated'::text)
    AND ((deleted_at IS NULL) OR (my_role() = 'super_admin'::text))
  );
