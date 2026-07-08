-- ============================================================================
-- FIX: no se puede eliminar un usuario si tiene pedidos creados o
-- registros de actividad asociados.
--
-- Diagnóstico (confirmado en producción vía pg_get_constraintdef):
--   - profiles_id_fkey, notificaciones_user_id_fkey y
--     pedido_asignados_user_id_fkey YA tenían ON DELETE CASCADE.
--   - pedidos_created_by_fkey, pedidos_deleted_by_fkey,
--     subtareas_asignado_a_fkey y actividad_user_id_fkey NO tenían
--     ninguna acción (default NO ACTION), así que Postgres rechaza el
--     DELETE en cuanto el usuario tiene aunque sea una fila en esas
--     tablas. Por eso supabaseAdmin.auth.admin.deleteUser() fallaba con
--     un usuario que ya había creado pedidos / tenía actividad, pero
--     funcionaba con usuarios invitados que nunca se habían logueado
--     (cero filas relacionadas, nada que bloquee).
--
-- Criterio: estas 4 son historial/auditoría, no "propiedad" del
-- usuario — se conserva el pedido/la subtarea/el registro de actividad,
-- se pierde únicamente la referencia a quién lo hizo (columna queda en
-- NULL). El front ya maneja el caso de perfil ausente
-- (ver labelActividad en useActividad.js: `item.profiles?.full_name ??
-- 'Alguien'`).
-- ============================================================================

ALTER TABLE public.pedidos DROP CONSTRAINT pedidos_created_by_fkey;
ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.pedidos DROP CONSTRAINT pedidos_deleted_by_fkey;
ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_deleted_by_fkey
  FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.subtareas DROP CONSTRAINT subtareas_asignado_a_fkey;
ALTER TABLE public.subtareas
  ADD CONSTRAINT subtareas_asignado_a_fkey
  FOREIGN KEY (asignado_a) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.actividad DROP CONSTRAINT actividad_user_id_fkey;
ALTER TABLE public.actividad
  ADD CONSTRAINT actividad_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Nota: no se toca profiles_id_fkey, notificaciones_user_id_fkey ni
-- pedido_asignados_user_id_fkey — ya estaban correctas.
