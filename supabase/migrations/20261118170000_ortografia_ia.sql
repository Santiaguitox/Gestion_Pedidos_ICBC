-- ============================================================================
-- Revisión de ortografía con IA (Edge Function revisar-ortografia)
--
-- Dos tablas internas y una función, TODAS accesibles solo desde la Edge
-- Function con service_role (mismo esquema que 20261118150000_alt_imagenes_ia):
--
--  1. ortografia_cache: hallazgos ya calculados para un mismo conjunto de
--     textos + glosario + versión del prompt (clave: hash). Revisar la misma
--     pieza dos veces seguidas no vuelve a gastar.
--
--  2. ortografia_ia_uso: contador de revisiones por día (día calendario de
--     Argentina). Es el tope de gasto del lado de la app; el tope duro de
--     plata está en la Claude Console.
--
--  3. ortografia_ia_consumir(cantidad, tope): reserva de forma ATÓMICA
--     cuántas revisiones se pueden hacer sin pasar el tope del día.
--
-- Seguridad: RLS activado SIN políticas, permisos revocados a anon y
-- authenticated, función SECURITY DEFINER con search_path fijo y ejecutable
-- solo por service_role.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ortografia_cache (
  hash       text PRIMARY KEY,
  hallazgos  jsonb NOT NULL,
  modelo     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ortografia_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ortografia_cache FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.ortografia_ia_uso (
  dia         date PRIMARY KEY,
  revisiones  integer NOT NULL DEFAULT 0 CHECK (revisiones >= 0)
);

ALTER TABLE public.ortografia_ia_uso ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ortografia_ia_uso FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.ortografia_ia_consumir(p_cantidad integer, p_tope integer)
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

  INSERT INTO public.ortografia_ia_uso (dia, revisiones) VALUES (v_dia, 0)
  ON CONFLICT (dia) DO NOTHING;

  SELECT revisiones INTO v_usado FROM public.ortografia_ia_uso WHERE dia = v_dia FOR UPDATE;

  v_otorgar := GREATEST(0, LEAST(p_cantidad, p_tope - v_usado));

  IF v_otorgar > 0 THEN
    UPDATE public.ortografia_ia_uso SET revisiones = revisiones + v_otorgar WHERE dia = v_dia;
  END IF;

  RETURN v_otorgar;
END;
$$;

REVOKE ALL ON FUNCTION public.ortografia_ia_consumir(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ortografia_ia_consumir(integer, integer) TO service_role;
