-- ============================================================================
-- Registro temporal de las respuestas de IA (para depurar y medir)
--
-- Guarda, por cada consulta real a la IA (no las que salen del caché), lo que
-- se le envió, lo que devolvió, cuántos hallazgos devolvió la IA y cuántos
-- quedaron después de los filtros. Sirve para entender por qué una revisión
-- sale vacía, rota o con avisos de más.
--
-- Es TEMPORAL: la Edge Function borra los registros de más de 7 días cada
-- vez que guarda uno nuevo. Con el tope diario de revisiones el volumen es
-- de unos pocos MB.
--
-- Seguridad (mismo esquema que las otras tablas de IA): RLS activado SIN
-- políticas y permisos revocados a anon y authenticated. Solo la Edge
-- Function (service_role) escribe, y se consulta desde el editor de Supabase.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ia_respuestas_log (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at        timestamptz NOT NULL DEFAULT now(),
  funcion           text    NOT NULL,
  version_prompt    text    NOT NULL,
  formato           boolean NOT NULL,   -- salida estructurada activa
  cebo              boolean NOT NULL,   -- cebo de ortografía activo
  estado            text    NOT NULL,   -- 'ok' o el motivo del fallo
  stop_reason       text,
  tokens_entrada    integer,
  tokens_salida     integer,
  hallazgos_ia      integer,            -- lo que devolvió la IA (sin el cebo)
  hallazgos_finales integer,            -- lo que quedó tras los filtros
  entrada           text,               -- textos enviados (recortado)
  respuesta         text                -- respuesta cruda (recortada)
);

CREATE INDEX IF NOT EXISTS ia_respuestas_log_created_at_idx
  ON public.ia_respuestas_log (created_at);

ALTER TABLE public.ia_respuestas_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ia_respuestas_log FROM anon, authenticated;

-- Métricas por día y función: sirve para ver de un vistazo si después de un
-- cambio suben las revisiones vacías o rotas.
CREATE OR REPLACE VIEW public.ia_metricas_diarias
WITH (security_invoker = true) AS
SELECT
  (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS dia,
  funcion,
  count(*)                                              AS revisiones,
  count(*) FILTER (WHERE estado = 'ok')                 AS ok,
  count(*) FILTER (WHERE estado <> 'ok')                AS con_falla,
  count(*) FILTER (WHERE estado = 'ok' AND hallazgos_ia = 0) AS ia_devolvio_vacio,
  coalesce(sum(hallazgos_ia - hallazgos_finales) FILTER (WHERE estado = 'ok'), 0) AS descartados_por_filtros,
  coalesce(sum(tokens_entrada), 0)                      AS tokens_entrada,
  coalesce(sum(tokens_salida), 0)                       AS tokens_salida
FROM public.ia_respuestas_log
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

REVOKE ALL ON public.ia_metricas_diarias FROM anon, authenticated;
