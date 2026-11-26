-- ============================================================================
-- "Desde pedido" del Editor de Piezas (Edge Function interpretar-pedido)
--
-- Mismo esquema que 20261118170000_ortografia_ia:
--  1. pedido_ia_cache: respuesta de la IA para un mismo pedido + fichas +
--     versión del prompt (clave: hash).
--  2. pedido_ia_uso: contador de consultas por día (día de Argentina).
--  3. pedido_ia_consumir(cantidad, tope): reserva ATÓMICA del cupo diario.
--
-- Seguridad: RLS activado SIN políticas, permisos revocados a anon y
-- authenticated, función SECURITY DEFINER ejecutable solo por service_role.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pedido_ia_cache (
  hash       text PRIMARY KEY,
  respuesta  jsonb NOT NULL,
  modelo     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pedido_ia_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pedido_ia_cache FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.pedido_ia_uso (
  dia         date PRIMARY KEY,
  consultas   integer NOT NULL DEFAULT 0 CHECK (consultas >= 0)
);

ALTER TABLE public.pedido_ia_uso ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pedido_ia_uso FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.pedido_ia_consumir(p_cantidad integer, p_tope integer)
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

  INSERT INTO public.pedido_ia_uso (dia, consultas) VALUES (v_dia, 0)
  ON CONFLICT (dia) DO NOTHING;

  SELECT consultas INTO v_usado FROM public.pedido_ia_uso WHERE dia = v_dia FOR UPDATE;

  v_otorgar := GREATEST(0, LEAST(p_cantidad, p_tope - v_usado));

  IF v_otorgar > 0 THEN
    UPDATE public.pedido_ia_uso SET consultas = consultas + v_otorgar WHERE dia = v_dia;
  END IF;

  RETURN v_otorgar;
END;
$$;

REVOKE ALL ON FUNCTION public.pedido_ia_consumir(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pedido_ia_consumir(integer, integer) TO service_role;
