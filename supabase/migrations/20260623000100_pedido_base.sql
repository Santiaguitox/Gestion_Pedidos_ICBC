-- ─── Step 1: Eliminar columna base_nombre de pedidos ─────────────────────
-- Esta columna fue reemplazada por la tabla pedido_base, que permite
-- múltiples bases por pedido y la relación opcional con una pieza específica.
ALTER TABLE pedidos DROP COLUMN IF EXISTS base_nombre;

-- ─── Step 2: Crear tabla pedido_base ──────────────────────────────────────
-- Guarda las bases de datos asociadas a un pedido.
-- header_line: primera línea del archivo (nombres de columnas separados por
-- el delimitador detectado). Se guarda en Supabase para no perderlo entre
-- sesiones — no contiene contactos ni datos sensibles, solo nombres de campos.
-- entregable_id: null = aplica a todas las piezas del pedido;
--                valor = aplica solo a esa pieza específica.
CREATE TABLE IF NOT EXISTS pedido_base (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  entregable_id   uuid REFERENCES entregable(id) ON DELETE SET NULL,
  nombre_archivo  text NOT NULL,
  header_line     text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Índice para traer todas las bases de un pedido rápido
CREATE INDEX IF NOT EXISTS pedido_base_pedido_id_idx ON pedido_base(pedido_id);

-- ─── Step 3: RLS ──────────────────────────────────────────────────────────
ALTER TABLE pedido_base ENABLE ROW LEVEL SECURITY;

-- Misma política que el resto de tablas del proyecto: usuarios autenticados
-- pueden leer y escribir. Ajustar si el proyecto tiene políticas más finas.
CREATE POLICY "autenticados pueden leer bases"
  ON pedido_base FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "autenticados pueden insertar bases"
  ON pedido_base FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "autenticados pueden actualizar bases"
  ON pedido_base FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "autenticados pueden eliminar bases"
  ON pedido_base FOR DELETE
  TO authenticated
  USING (true);
