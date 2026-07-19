-- ============================================================================
-- FIX: la tabla actividad aceptaba INSERT de cualquier autenticado, sin
-- validar nada más
--
-- Síntoma: "actividad: todos pueden insertar" solo chequeaba
-- auth.role() = 'authenticated' — no que user_id fuera quien está
-- logueado, ni que el rol pudiera realmente actuar sobre pedidos. En la
-- práctica, cualquier autenticado (incluido viewer) podía insertar una
-- fila directo contra la tabla con un user_id ajeno y un pedido_id
-- cualquiera — PedidoHistorial se lo muestra a todo el mundo como un
-- hecho real, así que esto es un vector de manipulación del historial /
-- auditoría, no algo cosmético. No estaba en la lista de riesgos ya
-- aceptados del informe original (esa lista solo cubría notificaciones).
--
-- Se confirmó contra el código: el único inserto real es
-- registrarActividad() en useActividad.js, y siempre manda
-- user_id = user?.id de la sesión propia del que llama — nunca un id
-- ajeno. Restringir a eso no rompe nada existente.
--
-- Fix: WITH CHECK exige que user_id sea el que está logueado, y que su
-- rol sea uno de los que puede tocar pedidos (mismo set que ya usa la
-- policy de UPDATE de pedidos — viewer queda afuera, igual que ya no
-- puede editar nada).
-- ============================================================================

DROP POLICY IF EXISTS "actividad: todos pueden insertar" ON public.actividad;
CREATE POLICY "actividad: solo el propio usuario, roles con permiso de editar pedidos"
  ON public.actividad FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'colaborador'::text])
  );
