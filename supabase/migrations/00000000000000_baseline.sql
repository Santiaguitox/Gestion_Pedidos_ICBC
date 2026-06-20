-- ============================================================================
-- BASELINE — Gestión de Pedidos ICBC
-- Generado: 2026-06-19
--
-- Este archivo documenta el estado COMPLETO del esquema de la base al
-- momento de generarlo: tablas, Row Level Security (RLS), policies,
-- funciones y triggers. Ya está aplicado en producción — no es una
-- migración para correr, es el punto de partida versionado del repo.
--
-- A partir de este archivo, cualquier cambio futuro al esquema (nueva
-- tabla, nueva policy, función modificada, etc.) debe documentarse como
-- un archivo de migración nuevo en supabase/migrations/, con su propio
-- timestamp, en lugar de editarse solo desde el dashboard de Supabase.
--
-- Si se necesita levantar un entorno nuevo desde cero (testing, staging),
-- correr este archivo primero y después, en orden, el resto de los
-- archivos de supabase/migrations/.
-- ============================================================================


-- ============================================================================
-- 1. TABLAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  full_name text,
  email text,
  role text NOT NULL DEFAULT 'colaborador'::text
    CHECK (role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'colaborador'::text, 'viewer'::text])),
  created_at timestamp with time zone DEFAULT now(),
  area_equipo text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.pedidos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  asunto text NOT NULL,
  descripcion text,
  prioridad text NOT NULL DEFAULT 'media'::text
    CHECK (prioridad = ANY (ARRAY['baja'::text, 'media'::text, 'alta'::text, 'urgente'::text])),
  tipo text NOT NULL DEFAULT 'creacion_email'::text
    CHECK (tipo = ANY (ARRAY['creacion_email'::text, 'programacion_envio'::text, 'correccion'::text, 'consulta'::text, 'otro'::text])),
  estados text[] NOT NULL DEFAULT '{}'::text[],
  tags text[] NOT NULL DEFAULT '{}'::text[],
  fecha_limite date,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  deleted_by uuid,
  instancia text,
  tipo_envio text,
  tipo_envio_otro text,
  cantidad_envios integer,
  fecha_programacion date,
  hora_programacion text,
  CONSTRAINT pedidos_pkey PRIMARY KEY (id),
  CONSTRAINT pedidos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT pedidos_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.pedido_asignados (
  pedido_id uuid NOT NULL,
  user_id uuid NOT NULL,
  CONSTRAINT pedido_asignados_pkey PRIMARY KEY (pedido_id, user_id),
  CONSTRAINT pedido_asignados_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id),
  CONSTRAINT pedido_asignados_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.subtareas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pedido_id uuid,
  descripcion text NOT NULL,
  completada boolean NOT NULL DEFAULT false,
  asignado_a uuid,
  created_at timestamp with time zone DEFAULT now(),
  registrado_sheet boolean DEFAULT false,
  registrado_sheet_at timestamp with time zone,
  completada_at timestamp with time zone,
  CONSTRAINT subtareas_pkey PRIMARY KEY (id),
  CONSTRAINT subtareas_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id),
  CONSTRAINT subtareas_asignado_a_fkey FOREIGN KEY (asignado_a) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.entregable (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pedido_id uuid,
  nombre_pieza text,
  link_online text,
  updated_at timestamp with time zone DEFAULT now(),
  aprobado boolean NOT NULL DEFAULT false,
  aprobado_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT entregable_pkey PRIMARY KEY (id),
  CONSTRAINT entregable_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id)
);

CREATE TABLE IF NOT EXISTS public.notificaciones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  pedido_id uuid,
  mensaje text NOT NULL,
  leida boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notificaciones_pkey PRIMARY KEY (id),
  CONSTRAINT notificaciones_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT notificaciones_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id)
);

CREATE TABLE IF NOT EXISTS public.actividad (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pedido_id uuid,
  user_id uuid,
  tipo text NOT NULL,
  detalle jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT actividad_pkey PRIMARY KEY (id),
  CONSTRAINT actividad_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id),
  CONSTRAINT actividad_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE IF NOT EXISTS public.estados (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280'::text,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT estados_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.tipos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280'::text,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tipos_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.instancias (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#6B7280'::text,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT instancias_pkey PRIMARY KEY (id)
);


-- ============================================================================
-- 2. ROW LEVEL SECURITY — habilitado en las 10 tablas, sin excepciones
-- ============================================================================

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_asignados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtareas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entregable       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actividad        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estados          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instancias       ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 3. FUNCIONES
-- ============================================================================

-- Devuelve el rol del usuario autenticado actual. Se usa en casi todas las
-- policies de RLS para chequear permisos por rol.
CREATE OR REPLACE FUNCTION public.my_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  select role from public.profiles where id = auth.uid()
$function$;

-- Crea automáticamente una fila en profiles cuando se registra un nuevo
-- usuario en auth.users (trigger en auth.users, ver sección Triggers).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  return new;
end;
$function$;

-- Actualiza automáticamente la columna updated_at en cada UPDATE.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- Bloquea que un usuario cambie su propio rol (o el id de su perfil) salvo
-- que ya sea admin/super_admin. Ver migración
-- 20260618000000_fix_escalacion_privilegios_profiles.sql para el contexto
-- completo del problema que resuelve.
CREATE OR REPLACE FUNCTION public.proteger_columnas_sensibles_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
begin
  if new.role is distinct from old.role then
    if public.my_role() not in ('super_admin', 'admin') then
      raise exception 'No tenés permisos para cambiar el rol';
    end if;
  end if;

  if new.id is distinct from old.id then
    raise exception 'No se puede modificar el id de un perfil';
  end if;

  return new;
end;
$function$;

-- Helper genérico para insertar una notificación. Usado por las funciones
-- de notif_* de abajo.
CREATE OR REPLACE FUNCTION public.crear_notificacion(p_user_id uuid, p_pedido_id uuid, p_mensaje text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
begin
  insert into public.notificaciones (user_id, pedido_id, mensaje)
  values (p_user_id, p_pedido_id, p_mensaje);
end;
$function$;

-- Notifica a todos los asignados de un pedido cuando una pieza entregable
-- pasa a aprobado = true.
CREATE OR REPLACE FUNCTION public.notif_aprobacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  v_asunto text;
  v_asignado record;
begin
  if OLD.aprobado = false and NEW.aprobado = true then
    select asunto into v_asunto from public.pedidos where id = NEW.pedido_id;
    for v_asignado in
      select user_id from public.pedido_asignados where pedido_id = NEW.pedido_id
    loop
      perform public.crear_notificacion(
        v_asignado.user_id,
        NEW.pedido_id,
        'Pieza aprobada en "' || v_asunto || '": ' || NEW.nombre_pieza
      );
    end loop;
  end if;
  return NEW;
end;
$function$;

-- Notifica al usuario asignado cuando se lo agrega a un pedido
-- (insert en pedido_asignados). No notifica a quien hizo la asignación
-- (ej: autoasignarse un pedido no genera notificación para uno mismo).
-- Ver migración 20260619000000_fix_notificaciones_duplicadas.sql.
CREATE OR REPLACE FUNCTION public.notif_asignacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  v_asunto text;
begin
  if NEW.user_id = auth.uid() then
    return NEW;
  end if;

  select asunto into v_asunto from public.pedidos where id = NEW.pedido_id;
  insert into public.notificaciones (user_id, pedido_id, mensaje)
  values (NEW.user_id, NEW.pedido_id, 'Te asignaron al pedido: ' || coalesce(v_asunto, 'sin título'));
  return NEW;
end;
$function$;

-- Notifica a los asignados de un pedido cuando cambia su array de estados.
-- No notifica a quien hizo el cambio.
CREATE OR REPLACE FUNCTION public.notif_cambio_estado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  v_asignado record;
  v_estados_nuevos text;
begin
  if OLD.estados is distinct from NEW.estados then
    if array_length(NEW.estados, 1) > 0 then
      v_estados_nuevos := array_to_string(NEW.estados, ', ');
      for v_asignado in
        select user_id from public.pedido_asignados where pedido_id = NEW.id
      loop
        if v_asignado.user_id != auth.uid() then
          perform public.crear_notificacion(
            v_asignado.user_id,
            NEW.id,
            '"' || NEW.asunto || '" cambió de estado: ' || v_estados_nuevos
          );
        end if;
      end loop;
    end if;
  end if;
  return NEW;
end;
$function$;

-- Notifica vencimientos próximos (pedidos sin finalizar que vencen en los
-- próximos 7 días). A diferencia de las demás funciones notif_*, esta NO
-- es un trigger — hay que invocarla activamente (manual o vía cron).
--
-- ESTADO ACTUAL (2026-06-19): la extensión pg_cron NO está habilitada en
-- este proyecto, así que esta función no se ejecuta sola todavía. Quedó
-- preparada a propósito para conectarla a futuro (alimentar la sección de
-- "Agenda del día" / pendientes del Dashboard). Si se decide activarla,
-- falta: habilitar pg_cron y programar un job diario que la invoque.
CREATE OR REPLACE FUNCTION public.notif_vencimientos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
declare
  v_pedido record;
  v_asignado record;
  v_dias int;
begin
  for v_pedido in
    select p.id, p.asunto, p.fecha_limite
    from public.pedidos p
    where p.deleted_at is null
      and p.fecha_limite is not null
      and not ('finalizado' = any(p.estados))
      and p.fecha_limite between current_date + 1 and current_date + 7
  loop
    v_dias := (v_pedido.fecha_limite - current_date);
    for v_asignado in
      select user_id from public.pedido_asignados where pedido_id = v_pedido.id
    loop
      if not exists (
        select 1 from public.notificaciones
        where pedido_id = v_pedido.id
          and user_id = v_asignado.user_id
          and mensaje like 'Vence%'
          and created_at::date = current_date
      ) then
        perform public.crear_notificacion(
          v_asignado.user_id,
          v_pedido.id,
          'Vence en ' || v_dias || ' día' || case when v_dias = 1 then '' else 's' end || ': ' || v_pedido.asunto
        );
      end if;
    end loop;
  end loop;
end;
$function$;


-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS entregable_updated_at ON public.entregable;
CREATE TRIGGER entregable_updated_at
  BEFORE UPDATE ON public.entregable
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_notif_aprobacion ON public.entregable;
CREATE TRIGGER trg_notif_aprobacion
  AFTER UPDATE ON public.entregable
  FOR EACH ROW EXECUTE FUNCTION public.notif_aprobacion();

DROP TRIGGER IF EXISTS trg_notif_asignacion ON public.pedido_asignados;
CREATE TRIGGER trg_notif_asignacion
  AFTER INSERT ON public.pedido_asignados
  FOR EACH ROW EXECUTE FUNCTION public.notif_asignacion();

DROP TRIGGER IF EXISTS pedidos_updated_at ON public.pedidos;
CREATE TRIGGER pedidos_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_notif_cambio_estado ON public.pedidos;
CREATE TRIGGER trg_notif_cambio_estado
  AFTER UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.notif_cambio_estado();

DROP TRIGGER IF EXISTS trg_proteger_columnas_sensibles_profiles ON public.profiles;
CREATE TRIGGER trg_proteger_columnas_sensibles_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_columnas_sensibles_profiles();

-- Nota: handle_new_user() está pensada para dispararse con un trigger
-- AFTER INSERT ON auth.users, pero esa tabla pertenece al esquema interno
-- de Supabase Auth y no aparece en information_schema.triggers con
-- trigger_schema = 'public'. Si se reconstruye este esquema desde cero,
-- confirmar en el dashboard de Supabase (Database > Triggers, filtrando
-- schema auth) que ese trigger exista, o recrearlo:
--
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- 5. POLICIES (RLS)
-- ============================================================================

-- --- actividad ---------------------------------------------------------
DROP POLICY IF EXISTS "actividad: todos pueden insertar" ON public.actividad;
CREATE POLICY "actividad: todos pueden insertar"
  ON public.actividad FOR INSERT
  WITH CHECK (auth.role() = 'authenticated'::text);

DROP POLICY IF EXISTS "actividad: todos pueden ver" ON public.actividad;
CREATE POLICY "actividad: todos pueden ver"
  ON public.actividad FOR SELECT
  USING (auth.role() = 'authenticated'::text);

-- --- entregable ----------------------------------------------------------
-- Nota: la policy "entregable: todos pueden modificar" (ALL, qual =
-- authenticated) existía originalmente y fue eliminada — ver migración
-- 20260618000100_limpieza_rls_duplicadas.sql. Permitía a cualquier
-- autenticado (incluido viewer) modificar/eliminar piezas.
DROP POLICY IF EXISTS "entregable: actualizar no aprobados" ON public.entregable;
CREATE POLICY "entregable: actualizar no aprobados"
  ON public.entregable FOR UPDATE
  USING (
    (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'colaborador'::text]))
    AND ((aprobado = false) OR (my_role() = 'super_admin'::text))
  );

DROP POLICY IF EXISTS "entregable: eliminar" ON public.entregable;
CREATE POLICY "entregable: eliminar"
  ON public.entregable FOR DELETE
  USING (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text]));

DROP POLICY IF EXISTS "entregable: insertar" ON public.entregable;
CREATE POLICY "entregable: insertar"
  ON public.entregable FOR INSERT
  WITH CHECK (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'colaborador'::text]));

DROP POLICY IF EXISTS "entregable: ver todos" ON public.entregable;
CREATE POLICY "entregable: ver todos"
  ON public.entregable FOR SELECT
  USING (auth.role() = 'authenticated'::text);

-- --- estados ---------------------------------------------------------------
DROP POLICY IF EXISTS "estados: admin puede modificar" ON public.estados;
CREATE POLICY "estados: admin puede modificar"
  ON public.estados FOR ALL
  USING (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text]));

DROP POLICY IF EXISTS "estados: todos pueden ver" ON public.estados;
CREATE POLICY "estados: todos pueden ver"
  ON public.estados FOR SELECT
  USING (auth.role() = 'authenticated'::text);

-- --- instancias --------------------------------------------------------
DROP POLICY IF EXISTS "instancias: admin puede modificar" ON public.instancias;
CREATE POLICY "instancias: admin puede modificar"
  ON public.instancias FOR ALL
  USING (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text]));

DROP POLICY IF EXISTS "instancias: todos pueden ver" ON public.instancias;
CREATE POLICY "instancias: todos pueden ver"
  ON public.instancias FOR SELECT
  USING (auth.role() = 'authenticated'::text);

-- --- notificaciones ------------------------------------------------------
-- Nota: "sistema puede insertar" permite insertar notificaciones para
-- CUALQUIER user_id, no solo el propio. Es intencional: permite notificar
-- a otro usuario cuando se le asigna un pedido o subtarea. Ver discusión
-- en la sesión del 2026-06-19 — riesgo aceptado (bajo impacto, no hay UI
-- que lo explote más allá de mandar notificaciones molestas).
DROP POLICY IF EXISTS "notificaciones: marcar leidas" ON public.notificaciones;
CREATE POLICY "notificaciones: marcar leidas"
  ON public.notificaciones FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notificaciones: sistema puede insertar" ON public.notificaciones;
CREATE POLICY "notificaciones: sistema puede insertar"
  ON public.notificaciones FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "notificaciones: ver propias" ON public.notificaciones;
CREATE POLICY "notificaciones: ver propias"
  ON public.notificaciones FOR SELECT
  USING (auth.uid() = user_id);

-- --- pedido_asignados ------------------------------------------------------
-- Nota: existía además "asignados: admin y colaborador modifican", policy
-- redundante con la de abajo (y más estrecha, no incluía super_admin).
-- Eliminada en 20260618000100_limpieza_rls_duplicadas.sql.
DROP POLICY IF EXISTS "asignados: modificar" ON public.pedido_asignados;
CREATE POLICY "asignados: modificar"
  ON public.pedido_asignados FOR ALL
  USING (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'colaborador'::text]))
  WITH CHECK (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'colaborador'::text]));

DROP POLICY IF EXISTS "asignados: ver todos" ON public.pedido_asignados;
CREATE POLICY "asignados: ver todos"
  ON public.pedido_asignados FOR SELECT
  USING (auth.role() = 'authenticated'::text);

-- --- pedidos -------------------------------------------------------------
-- Nota: el UPDATE necesita WITH CHECK explícito (no alcanza con que sea
-- igual al USING implícito) para que admin pueda completar el soft-delete
-- sin que Postgres evalúe la visibilidad post-UPDATE contra la policy de
-- SELECT. Ver 20260618000200_fix_admin_eliminar_pedidos.sql para el detalle
-- completo de por qué esto rompía.
DROP POLICY IF EXISTS "pedidos: admin y super_admin actualizan" ON public.pedidos;
CREATE POLICY "pedidos: admin y super_admin actualizan"
  ON public.pedidos FOR UPDATE
  USING (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'colaborador'::text]))
  WITH CHECK (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'colaborador'::text]));

DROP POLICY IF EXISTS "pedidos: insertar" ON public.pedidos;
CREATE POLICY "pedidos: insertar"
  ON public.pedidos FOR INSERT
  WITH CHECK (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'colaborador'::text]));

DROP POLICY IF EXISTS "pedidos: solo super_admin elimina" ON public.pedidos;
CREATE POLICY "pedidos: solo super_admin elimina"
  ON public.pedidos FOR DELETE
  USING (my_role() = 'super_admin'::text);

-- Nota: admin (además de super_admin) puede ver filas con deleted_at NOT
-- NULL a nivel de base, aunque la Papelera de la UI esté restringida a
-- super_admin por ProtectedRoute en el frontend. Es necesario para que el
-- soft-delete hecho por admin se pueda completar (ver nota de arriba).
DROP POLICY IF EXISTS "pedidos: ver activos" ON public.pedidos;
CREATE POLICY "pedidos: ver activos"
  ON public.pedidos FOR SELECT
  USING (
    (auth.role() = 'authenticated'::text)
    AND ((deleted_at IS NULL) OR (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text])))
  );

-- --- profiles --------------------------------------------------------------
DROP POLICY IF EXISTS "profiles: admin puede editar area_equipo" ON public.profiles;
CREATE POLICY "profiles: admin puede editar area_equipo"
  ON public.profiles FOR UPDATE
  USING (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text]))
  WITH CHECK (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text]));

-- Nota: esta policy permite a cualquier usuario UPDATE sobre su propia
-- fila sin restringir columnas. La protección de que NO pueda cambiarse
-- su propio `role` la da el trigger trg_proteger_columnas_sensibles_profiles
-- (sección Triggers), no esta policy — Postgres RLS no permite restringir
-- columnas específicas dentro de una misma policy de UPDATE.
DROP POLICY IF EXISTS "profiles: editar propio" ON public.profiles;
CREATE POLICY "profiles: editar propio"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles: ver todos" ON public.profiles;
CREATE POLICY "profiles: ver todos"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated'::text);

-- --- subtareas -------------------------------------------------------------
-- Nota: existía además "subtareas: todos menos viewer modifican", policy
-- duplicada de la de abajo. Eliminada en
-- 20260618000100_limpieza_rls_duplicadas.sql.
DROP POLICY IF EXISTS "subtareas: modificar" ON public.subtareas;
CREATE POLICY "subtareas: modificar"
  ON public.subtareas FOR ALL
  USING (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'colaborador'::text]))
  WITH CHECK (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'colaborador'::text]));

DROP POLICY IF EXISTS "subtareas: ver todos" ON public.subtareas;
CREATE POLICY "subtareas: ver todos"
  ON public.subtareas FOR SELECT
  USING (auth.role() = 'authenticated'::text);

-- --- tipos -------------------------------------------------------------
DROP POLICY IF EXISTS "tipos: admin puede modificar" ON public.tipos;
CREATE POLICY "tipos: admin puede modificar"
  ON public.tipos FOR ALL
  USING (my_role() = ANY (ARRAY['super_admin'::text, 'admin'::text]));

DROP POLICY IF EXISTS "tipos: todos pueden ver" ON public.tipos;
CREATE POLICY "tipos: todos pueden ver"
  ON public.tipos FOR SELECT
  USING (auth.role() = 'authenticated'::text);
