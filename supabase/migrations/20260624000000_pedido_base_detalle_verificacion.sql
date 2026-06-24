-- Extiende pedido_base para soportar:
--  1) Resultado POR PIEZA cuando una base aplica a "todas las piezas"
--     (entregable_id null) — antes se mezclaba todo en un solo conteo
--     agregado (resultado_miss_count), perdiendo cuál pieza específica
--     fallaba. Ahora se guarda un detalle por pieza en JSON.
--  2) Lista de campos faltantes (no solo el conteo) — para mostrar el
--     detalle expandible sin tener que re-correr la verificación.
--  3) Timestamp de la última verificación — para mostrar "verificado
--     hace 3 días" y poder detectar si conviene re-verificar.
--
-- resultado_detalle: jsonb, forma:
--   [{ "entregable_id": "uuid"|null, "nombre_pieza": text, "miss": text[] }, ...]
-- Un elemento por pieza evaluada. Para bases asignadas a una sola pieza
-- (entregable_id no null en pedido_base) el array tiene un solo elemento.
-- resultado_miss_count se mantiene por compatibilidad con filas viejas
-- y como conteo total rápido (suma de todos los miss), pero la fuente
-- de verdad pasa a ser resultado_detalle.
ALTER TABLE pedido_base ADD COLUMN IF NOT EXISTS resultado_detalle jsonb;
ALTER TABLE pedido_base ADD COLUMN IF NOT EXISTS verificado_at timestamptz;
