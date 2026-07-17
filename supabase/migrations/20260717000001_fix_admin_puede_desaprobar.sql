-- ============================================================================
-- FIX: admin ve el botón "Desaprobar" pero RLS solo se lo permite a
-- super_admin
--
-- Síntoma: EntregablesSection muestra "Desaprobar" a cualquiera con
-- canWrite (incluye admin), pero la policy "entregable: actualizar no
-- aprobados" solo dejaba pasar el UPDATE sobre una fila con
-- aprobado = true si my_role() = 'super_admin'. Un admin que tocaba el
-- botón recibía "No se pudo actualizar la aprobación" sin poder hacer
-- nada.
--
-- Decisión de negocio (confirmada): admin SÍ puede desaprobar, igual que
-- super_admin.
--
-- Fix: sumar 'admin' junto a 'super_admin' en la excepción de la policy.
-- Mismo criterio de acceso amplio que ya tenía super_admin (puede tocar
-- la fila incluso con aprobado = true) — la UI sigue siendo la que
-- distingue qué botones expone (Aprobar/Desaprobar vs. Editar).
-- ============================================================================

DROP POLICY IF EXISTS "entregable: actualizar no aprobados" ON public.entregable;
CREATE POLICY "entregable: actualizar no aprobados"
  ON public.entregable FOR UPDATE
  USING (
    (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'colaborador'::text]))
    AND ((aprobado = false) OR (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text])))
  );
