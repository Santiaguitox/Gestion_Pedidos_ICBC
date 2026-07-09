-- ============================================================================
-- PUSH IDEMPOTENTE — cada notificación se despacha como Web Push UNA vez
--
-- Problema que cierra: la Edge Function enviar-push es invocable con la
-- anon key (pública, por diseño — el trigger de pg_net la usa). El
-- contenido no se puede fabricar (la función re-consulta la fila con
-- service role), pero cualquiera con la anon key podía RE-disparar en
-- loop una notificación legítima ya existente, spameando push al dueño
-- real de esa notificación.
--
-- Solución: columna push_despachado_at + "claim" atómico en la función.
-- La Edge Function ya no hace SELECT y después envía: hace un UPDATE
-- condicionado (set push_despachado_at = now() WHERE id = X AND
-- push_despachado_at IS NULL ... RETURNING *). Si el UPDATE no devuelve
-- fila, la notificación no existe o YA fue despachada — se responde
-- { enviadas: 0 } sin enviar nada. Como el claim es un único UPDATE
-- atómico, dos requests simultáneos por el mismo id no pueden despachar
-- los dos: uno gana la fila, el otro recibe 0 filas.
--
-- El flujo legítimo no cambia en nada: el trigger dispara una sola vez
-- por INSERT, esa única invocación hace el claim y envía. Es best-effort
-- igual que antes: si el envío web-push falla después del claim, no hay
-- reintento (mismo comportamiento que ya tenía la función ante errores
-- del servicio de push).
-- ============================================================================

alter table public.notificaciones
  add column if not exists push_despachado_at timestamptz;

comment on column public.notificaciones.push_despachado_at is
  'Momento en que la Edge Function enviar-push tomó (claim) esta notificación para despachar Web Push. NULL = todavía no despachada. Una vez seteado, la función rechaza re-despachos del mismo id.';
