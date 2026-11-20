-- ============================================================================
-- Verificación de alt vs. imagen con IA (Edge Function verificar-alt-imagenes)
--
-- Dos tablas internas y una función, TODAS accesibles solo desde la Edge
-- Function con service_role:
--
--  1. alt_verificaciones_cache: resultado ya calculado por (imagen, alt).
--     Logos, headers y footers se repiten entre piezas; sin caché se
--     pagaría la misma consulta una y otra vez. La Edge Function ignora
--     entradas con más de 7 días (una imagen puede reemplazarse manteniendo
--     la misma URL).
--
--  2. alt_ia_uso: contador de imágenes analizadas por día. Es el tope de
--     gasto del lado de la app (el tope duro de plata está en la Claude
--     Console). Se mide por día calendario de Argentina.
--
--  3. alt_ia_consumir(cantidad, tope): reserva de forma ATÓMICA cuántas
--     imágenes puede analizar la llamada sin pasar el tope del día. Con
--     FOR UPDATE, dos revisiones simultáneas no pueden pasarse del tope
--     entre las dos.
--
-- Seguridad: RLS activado SIN políticas (ningún usuario de la app lee ni
-- escribe estas tablas por la API) y permisos revocados a anon y
-- authenticated. La función es SECURITY DEFINER con search_path fijo
-- (mismo criterio que 20260701000000_fix_search_path_funciones) y solo
-- service_role puede ejecutarla.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.alt_verificaciones_cache (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  src_hash        text NOT NULL,
  alt_hash        text NOT NULL,
  src             text NOT NULL,
  alt             text NOT NULL,
  veredicto       text NOT NULL CHECK (veredicto IN ('coincide', 'no_coincide', 'dudoso')),
  texto_detectado text,
  motivo          text,
  modelo          text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alt_verificaciones_cache_unica UNIQUE (src_hash, alt_hash)
);

ALTER TABLE public.alt_verificaciones_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.alt_verificaciones_cache FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.alt_ia_uso (
  dia      date PRIMARY KEY,
  imagenes integer NOT NULL DEFAULT 0 CHECK (imagenes >= 0)
);

ALTER TABLE public.alt_ia_uso ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.alt_ia_uso FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.alt_ia_consumir(p_cantidad integer, p_tope integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dia     date := (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;
  v_usado   integer;
  v_otorgar integer;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad <= 0 OR p_tope IS NULL OR p_tope <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.alt_ia_uso (dia, imagenes) VALUES (v_dia, 0)
  ON CONFLICT (dia) DO NOTHING;

  SELECT imagenes INTO v_usado FROM public.alt_ia_uso WHERE dia = v_dia FOR UPDATE;

  v_otorgar := GREATEST(0, LEAST(p_cantidad, p_tope - v_usado));

  IF v_otorgar > 0 THEN
    UPDATE public.alt_ia_uso SET imagenes = imagenes + v_otorgar WHERE dia = v_dia;
  END IF;

  RETURN v_otorgar;
END;
$$;

REVOKE ALL ON FUNCTION public.alt_ia_consumir(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alt_ia_consumir(integer, integer) TO service_role;
