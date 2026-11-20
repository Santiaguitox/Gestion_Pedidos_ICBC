-- El cebo de ortografía se retiró (no mostró beneficio), así que la columna
-- del registro temporal ya no se usa. Aplicar ANTES de desplegar la versión
-- nueva de revisar-ortografia (si se invierte el orden, solo falla el
-- registro de ese rato; la revisión sigue funcionando).
ALTER TABLE public.ia_respuestas_log DROP COLUMN IF EXISTS cebo;
