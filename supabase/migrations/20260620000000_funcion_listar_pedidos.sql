-- ============================================================================
-- FUNCIÓN: listar_pedidos
--
-- ⚠️  IMPORTANTE: si en el futuro se le agrega/quita/reordena un parámetro
-- a esta función, "create or replace" NO la reemplaza — Postgres crea una
-- versión NUEVA en paralelo si la firma cambia, dejando la vieja viva.
-- Esto causó un bug real el 2026-06-20 (Pedidos.jsx dejó de traer datos
-- por ambigüedad entre 3 versiones acumuladas). Después de modificar los
-- parámetros, correr:
--   select proname, pg_get_function_arguments(oid) from pg_proc
--   where proname = 'listar_pedidos';
-- Si aparece más de una fila, borrar las versiones viejas con DROP
-- FUNCTION listar_pedidos(<firma exacta de la vieja>);
--
-- Centraliza toda la lógica de "qué pedidos mostrar" en Pedidos.jsx y
-- Dashboard.jsx, en lugar de filtrar client-side sobre una lista completa
-- cargada de una. Ver docs/spec-paginacion-pedidos-v2.md para el diseño.
--
-- MODOS de rango temporal (parámetro p_modo), mutuamente excluyentes:
--   'normal'      -> created_at en los últimos p_dias_normal días (default
--                    30). Es el modo por defecto de Pedidos.jsx.
--   'historico'   -> SOLO pedidos activos (sin el estado 'finalizado'),
--                    sin importar created_at. No incluye finalizados nunca,
--                    sin importar mostrar_finalizados.
--   'vencimiento' -> fecha_limite entre p_vence_desde y p_vence_hasta, sin
--                    límite de created_at. Incluye finalizados.
--   'dashboard'   -> SOLO pedidos activos (sin 'finalizado'), CON o SIN
--                    fecha_limite, sin límite de created_at, SIN PAGINAR
--                    (ver nota en el CTE 'pagina' más abajo) — usado por
--                    Dashboard.jsx para agrupar en las 7 categorías
--                    semánticas (Vencidos/Hoy/Mañana/Esta semana/Próxima
--                    semana/Más adelante/Sin fecha límite) en el cliente.
--
-- BÚSQUEDA (p_busqueda): si tiene texto, ignora el modo de rango temporal
-- por completo (busca en TODO el historial) — pero los filtros base
-- (prioridad/tipo/estado/tag/usuario) siguen aplicando igual. Incluye
-- finalizados.
--
-- FILTROS BASE (siempre aplican si están presentes, sin importar el modo):
-- p_prioridad, p_tipo, p_estado, p_tag, p_usuario_id (filtra por
-- asignación en pedido_asignados — usado tanto por "Mis pedidos" como
-- por elegir cualquier otro usuario del selector).
--
-- p_mostrar_finalizados: solo tiene efecto en modo 'normal' (en los demás
-- casos el comportamiento de finalizados ya está definido arriba, fijo).
--
-- Devuelve una tabla con una sola fila: el array de pedidos (como jsonb,
-- con sus relaciones anidadas igual que el .select() de Supabase que
-- reemplaza) y el total de filas que matchean (sin paginar), para que el
-- cliente pueda calcular cuántas páginas hay.
-- ============================================================================

create or replace function public.listar_pedidos(
  p_modo text default 'normal',              -- 'normal' | 'historico' | 'vencimiento' | 'dashboard'
  p_dias_normal int default 30,
  p_vence_desde date default null,
  p_vence_hasta date default null,
  p_busqueda text default null,
  p_prioridad text default null,
  p_tipo text default null,
  p_estado text default null,                -- 'sin_estado' = sin ningún estado
  p_tag text default null,
  p_usuario_id uuid default null,            -- filtra por asignación (pedido_asignados)
  p_mostrar_finalizados boolean default false,
  p_pagina int default 0,                     -- 0-indexed
  p_pagina_size int default 30,
  p_solo_id uuid default null                 -- si viene, filtra a un único pedido (usado por el realtime puntual)
)
returns table(pedidos jsonb, total bigint)
language plpgsql
security invoker
as $function$
declare
  v_offset int := p_pagina * p_pagina_size;
begin
  return query
  with base as (
    select p.*,
      -- Solo tiene sentido cuando hay búsqueda activa (p_busqueda no
      -- nulo) — indica en qué campo "pegó" la coincidencia, para que
      -- el cliente (ver BuscadorGlobal.jsx) pueda mostrar un ícono
      -- distinto según el tipo. Se evalúa en el mismo orden que el
      -- WHERE de más abajo: asunto primero, después tags, después
      -- pieza/link, después nombre de persona asignada — si matchea
      -- por más de uno a la vez, se prioriza el primero de esta lista.
      (case
        when p_busqueda is null then null
        when p.asunto ilike '%' || p_busqueda || '%' then 'asunto'
        when exists (select 1 from unnest(p.tags) t where t ilike '%' || p_busqueda || '%') then 'tag'
        when exists (
          select 1 from public.entregable e
          where e.pedido_id = p.id
            and (e.nombre_pieza ilike '%' || p_busqueda || '%' or e.link_online ilike '%' || p_busqueda || '%')
        ) then 'pieza'
        when exists (
          select 1 from public.pedido_asignados pa3
          join public.profiles pr3 on pr3.id = pa3.user_id
          where pa3.pedido_id = p.id and pr3.full_name ilike '%' || p_busqueda || '%'
        ) then 'persona'
        else null
      end) as coincidencia_en
    from public.pedidos p
    where p.deleted_at is null
      and (p_solo_id is null or p.id = p_solo_id)
      -- Filtros base, aplican siempre que vengan informados
      and (p_prioridad is null or p.prioridad = p_prioridad)
      and (p_tipo is null or p.tipo = p_tipo)
      and (
        p_estado is null
        or (p_estado = 'sin_estado' and (p.estados is null or array_length(p.estados, 1) is null))
        or (p_estado <> 'sin_estado' and p_estado = any(p.estados))
      )
      and (p_tag is null or p_tag = any(p.tags))
      and (
        p_usuario_id is null
        or exists (select 1 from public.pedido_asignados pa2 where pa2.pedido_id = p.id and pa2.user_id = p_usuario_id)
      )
      and (
        -- Búsqueda: ignora el modo de rango temporal, busca en todo
        (p_busqueda is not null and (
          p.asunto ilike '%' || p_busqueda || '%'
          or exists (select 1 from unnest(p.tags) t where t ilike '%' || p_busqueda || '%')
          or exists (
            select 1 from public.entregable e
            where e.pedido_id = p.id
              and (e.nombre_pieza ilike '%' || p_busqueda || '%' or e.link_online ilike '%' || p_busqueda || '%')
          )
          or exists (
            select 1 from public.pedido_asignados pa3
            join public.profiles pr3 on pr3.id = pa3.user_id
            where pa3.pedido_id = p.id and pr3.full_name ilike '%' || p_busqueda || '%'
          )
        ))
        or
        -- Sin búsqueda: aplica el modo de rango temporal correspondiente
        (p_busqueda is null and (
          (p_modo = 'normal' and p.created_at >= (now() - (p_dias_normal || ' days')::interval)
            and (p_mostrar_finalizados or not ('finalizado' = any(p.estados))))
          or (p_modo = 'historico' and not ('finalizado' = any(p.estados))
            and p.created_at < (now() - (p_dias_normal || ' days')::interval))
          or (p_modo = 'vencimiento' and p.fecha_limite is not null
            and (p_vence_desde is null or p.fecha_limite >= p_vence_desde)
            and (p_vence_hasta is null or p.fecha_limite <= p_vence_hasta))
          or (p_modo = 'dashboard' and not ('finalizado' = any(p.estados)))
        ))
      )
  ),
  contado as (
    select count(*) as cantidad_total from base
  ),
  pagina as (
    select * from base
    order by created_at desc
    -- En modo 'dashboard' no se pagina del lado SQL: la paginación real
    -- es por GRUPO SEMÁNTICO (Vencidos/Hoy/Mañana/etc.) en el cliente,
    -- no por página plana. Se usa un límite generoso como red de
    -- seguridad, no como paginación real.
    limit (case when p_modo = 'dashboard' then 5000 else p_pagina_size end)
    offset (case when p_modo = 'dashboard' then 0 else v_offset end)
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', pg.id,
        'asunto', pg.asunto,
        'descripcion', pg.descripcion,
        'prioridad', pg.prioridad,
        'tipo', pg.tipo,
        'estados', pg.estados,
        'tags', pg.tags,
        'coincidencia_en', pg.coincidencia_en,
        'fecha_limite', pg.fecha_limite,
        'created_by', pg.created_by,
        'created_at', pg.created_at,
        'updated_at', pg.updated_at,
        'instancia', pg.instancia,
        'tipo_envio', pg.tipo_envio,
        'tipo_envio_otro', pg.tipo_envio_otro,
        'cantidad_envios', pg.cantidad_envios,
        'fecha_programacion', pg.fecha_programacion,
        'hora_programacion', pg.hora_programacion,
        'pedido_asignados', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'user_id', pa.user_id,
            'profiles', jsonb_build_object('id', pr.id, 'full_name', pr.full_name, 'role', pr.role, 'avatar_color', pr.avatar_color)
          )), '[]'::jsonb)
          from public.pedido_asignados pa
          join public.profiles pr on pr.id = pa.user_id
          where pa.pedido_id = pg.id
        ),
        'subtareas', (
          select coalesce(jsonb_agg(s.*), '[]'::jsonb)
          from public.subtareas s
          where s.pedido_id = pg.id
        ),
        'entregable', (
          select coalesce(jsonb_agg(e.*), '[]'::jsonb)
          from public.entregable e
          where e.pedido_id = pg.id
        )
      )
      order by pg.created_at desc
    ), '[]'::jsonb) as pedidos,
    (select cantidad_total from contado) as total
  from pagina pg;
end;
$function$;

-- security invoker (no definer): la función corre con los permisos del
-- usuario que la llama, así que sigue respetando las policies de RLS de
-- pedidos/entregable/subtareas/pedido_asignados/profiles tal cual están
-- hoy — no se está creando un atajo que esquive seguridad.
