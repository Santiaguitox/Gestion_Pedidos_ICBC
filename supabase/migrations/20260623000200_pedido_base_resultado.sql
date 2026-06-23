-- Agrega columnas para persistir el resultado de la verificación
-- de compatibilidad base↔pieza, para que no se pierda entre sesiones.
ALTER TABLE pedido_base ADD COLUMN IF NOT EXISTS resultado_tipo text;
ALTER TABLE pedido_base ADD COLUMN IF NOT EXISTS resultado_miss_count integer;
-- resultado_tipo: 'ok' | 'error_proxy' | 'miss' | null (no verificado aún)
