-- Agrega el campo base_nombre a la tabla pedidos.
-- Guarda solo el nombre del archivo de la base de datos (.csv/.txt/.xlsx)
-- asociada al pedido — nunca los contactos ni el contenido real,
-- que se descartan en el navegador por privacidad. El encabezado
-- (nombres de columnas) se persiste en localStorage del browser.
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS base_nombre text;
