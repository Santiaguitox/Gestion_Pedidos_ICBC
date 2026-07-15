-- ============================================================================
-- PIEZAS BORRADORES — guardado multi-pieza del Editor de Piezas
--
-- Hasta ahora el Editor de Piezas solo tenía UN borrador, en
-- localStorage del navegador (ver useLocalStorage('ep_borrador', ...)
-- en EditorPiezas.jsx) — no había forma de tener dos piezas a medias
-- a la vez, ni de seguir editando desde otra compu, ni de que el
-- trabajo sobreviva a un "Reiniciar" accidental o a borrar datos del
-- navegador. Esta tabla agrega guardado explícito y con nombre
-- ("Mis piezas"), sin tocar el autosave local existente — ese sigue
-- funcionando exactamente igual, como red de seguridad de la pieza
-- que se está editando en este momento (recuperación ante un cierre
-- accidental de la pestaña). Guardar en la nube es una acción
-- explícita del usuario (botón "Guardar"), no automática — decisión
-- tomada a propósito para no generar tráfico de escritura en cada
-- cambio y para que el usuario decida cuándo una pieza está en un
-- punto que vale la pena versionar.
--
-- Diseño de acceso (confirmado en la conversación de entrega):
--   - Privado por usuario: cada colaborador/admin ve y edita SOLO sus
--     propias piezas guardadas.
--   - Excepción: super_admin puede VER (no editar/eliminar) las de
--     todo el equipo — pensado para poder destrabar o revisar el
--     trabajo de alguien sin depender de que esa persona esté
--     disponible. La escritura (UPDATE/DELETE) sigue siendo
--     exclusiva del dueño de la fila incluso para super_admin: ver
--     el trabajo ajeno no significa poder pisarlo.
--   - Mismos 3 roles que ya protegen la ruta /editor-piezas en
--     App.jsx (super_admin, admin, colaborador) — 'viewer' queda
--     afuera en INSERT, igual criterio que pedido_comentarios.
--
-- Límite de 20 piezas guardadas por usuario (a pedido explícito,
-- "pondría un máximo") — se aplica en un trigger BEFORE INSERT, no
-- solo en la UI: así no se puede eludir llamando a la API directo. Si
-- 20 resulta poco o mucho en la práctica, es un solo número para
-- ajustar (ver piezas_borradores_limitar más abajo).
-- ============================================================================


-- ============================================================================
-- 1. TABLA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.piezas_borradores (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  nombre     text NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 200),
  -- Mismo shape que ya arma construirBorrador() en EditorPiezas.jsx
  -- (tema, bandaHeaderSlug, redesOrden, canvas, imgPrincipal,
  -- imgFooter, legalesAdicionales, legalesSeparados,
  -- firmaInstitucional, indicadores) — jsonb en vez de columnas
  -- separadas porque ese shape puede seguir creciendo (nuevos campos
  -- del editor) sin necesitar una migración nueva cada vez, igual
  -- criterio que ya usa la columna `data` en otras tablas del proyecto
  -- para blobs estructurados que solo el frontend interpreta.
  data       jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT piezas_borradores_pkey PRIMARY KEY (id),
  CONSTRAINT piezas_borradores_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS piezas_borradores_user_id_idx ON public.piezas_borradores (user_id);


-- ============================================================================
-- 2. TRIGGERS — updated_at automático + límite de 20 piezas por usuario
-- ============================================================================

DROP TRIGGER IF EXISTS piezas_borradores_updated_at ON public.piezas_borradores;
CREATE TRIGGER piezas_borradores_updated_at
  BEFORE UPDATE ON public.piezas_borradores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Límite duro de piezas guardadas por usuario. SECURITY DEFINER +
-- search_path fijo, mismo criterio de hardening que el resto de las
-- funciones del proyecto (ver 20260701000000_fix_search_path_funciones).
-- Cuenta las filas EXISTENTES de ese user_id antes del insert nuevo —
-- si ya llegó al límite, se corta con una excepción clara que el
-- frontend puede mostrar tal cual (no es un error genérico de
-- Postgres, el mensaje ya está pensado para mostrarse al usuario).
CREATE OR REPLACE FUNCTION public.piezas_borradores_limitar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
declare
  cantidad_actual int;
  limite constant int := 20;
begin
  select count(*) into cantidad_actual
  from public.piezas_borradores
  where user_id = new.user_id;

  if cantidad_actual >= limite then
    raise exception 'Llegaste al máximo de % piezas guardadas. Eliminá alguna antes de guardar una nueva.', limite
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS piezas_borradores_limitar_trigger ON public.piezas_borradores;
CREATE TRIGGER piezas_borradores_limitar_trigger
  BEFORE INSERT ON public.piezas_borradores
  FOR EACH ROW EXECUTE FUNCTION public.piezas_borradores_limitar();


-- ============================================================================
-- 3. RLS
-- ============================================================================

ALTER TABLE public.piezas_borradores ENABLE ROW LEVEL SECURITY;

-- Lectura: el dueño ve las propias, super_admin ve todas (para poder
-- destrabar/revisar sin depender de que el dueño esté disponible).
DROP POLICY IF EXISTS "piezas_borradores: dueño o super_admin leen" ON public.piezas_borradores;
CREATE POLICY "piezas_borradores: dueño o super_admin leen"
  ON public.piezas_borradores FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.my_role() = 'super_admin'
  );

-- Escritura (insert): solo a nombre propio, y solo los 3 roles que ya
-- tienen acceso a la ruta /editor-piezas (mismo criterio que
-- pedido_comentarios: 'viewer' queda afuera).
DROP POLICY IF EXISTS "piezas_borradores: equipo guarda a nombre propio" ON public.piezas_borradores;
CREATE POLICY "piezas_borradores: equipo guarda a nombre propio"
  ON public.piezas_borradores FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.my_role() = ANY (ARRAY['super_admin', 'admin', 'colaborador'])
  );

-- Actualización: SOLO el dueño, incluso para super_admin — "ver el
-- trabajo de todos" no incluye poder pisarlo.
DROP POLICY IF EXISTS "piezas_borradores: solo el dueño edita" ON public.piezas_borradores;
CREATE POLICY "piezas_borradores: solo el dueño edita"
  ON public.piezas_borradores FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Borrado: mismo criterio que UPDATE, solo el dueño.
DROP POLICY IF EXISTS "piezas_borradores: solo el dueño elimina" ON public.piezas_borradores;
CREATE POLICY "piezas_borradores: solo el dueño elimina"
  ON public.piezas_borradores FOR DELETE
  USING (auth.uid() = user_id);
