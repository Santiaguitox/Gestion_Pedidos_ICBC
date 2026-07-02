-- ============================================================================
-- Fija search_path en todas las funciones del schema public.
--
-- CONTEXTO: el linter de Supabase marca "function_search_path_mutable" en
-- toda función sin search_path fijo. El riesgo REAL es en las funciones
-- SECURITY DEFINER: corren con los privilegios del dueño (postgres), así
-- que si su search_path es mutable, alguien que logre crear un objeto en
-- un schema que resuelva ANTES que public podría hacer que la función
-- llame a SU objeto en vez del real (search_path hijacking) y ejecutar
-- código con privilegios elevados. Fijando "public, pg_temp" la resolución
-- de nombres queda anclada y ese vector se cierra.
--
-- En las funciones SECURITY INVOKER (set_updated_at, listar_pedidos) el
-- riesgo es mucho menor —corren con los privilegios de quien llama— pero
-- se les fija igual para dejar el linter en cero y por buena práctica.
--
-- Se usa ALTER FUNCTION (no CREATE OR REPLACE) a propósito: solo cambia
-- este setting, sin tocar el cuerpo de las funciones. pg_temp va SIEMPRE
-- al final del search_path (recomendación de la doc de Postgres para
-- SECURITY DEFINER: evita que objetos temporales de la sesión del atacante
-- interfieran en la resolución de nombres).
-- ============================================================================

-- --- SECURITY DEFINER (el fix de seguridad real) --------------------------
ALTER FUNCTION public.my_role()                              SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user()                      SET search_path = public, pg_temp;
ALTER FUNCTION public.proteger_columnas_sensibles_profiles() SET search_path = public, pg_temp;
ALTER FUNCTION public.crear_notificacion(uuid, uuid, text)   SET search_path = public, pg_temp;
ALTER FUNCTION public.notif_aprobacion()                     SET search_path = public, pg_temp;
ALTER FUNCTION public.notif_asignacion()                     SET search_path = public, pg_temp;
ALTER FUNCTION public.notif_cambio_estado()                  SET search_path = public, pg_temp;
ALTER FUNCTION public.notif_vencimientos()                   SET search_path = public, pg_temp;

-- --- SECURITY INVOKER (solo para dejar el linter en cero) ------------------
ALTER FUNCTION public.set_updated_at()  SET search_path = public, pg_temp;
ALTER FUNCTION public.listar_pedidos(text, int, date, date, text, text, text, text, text, uuid, boolean, int, int, uuid) SET search_path = public, pg_temp;
