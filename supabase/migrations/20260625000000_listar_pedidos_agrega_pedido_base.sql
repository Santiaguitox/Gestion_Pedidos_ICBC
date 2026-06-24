-- ============================================================================
-- FUNCIÓN: listar_pedidos — agrega 'pedido_base' al jsonb de cada pedido
--
-- Mismo patrón exacto que 'entregable' (sub-select correlacionado por
-- pedido_id, jsonb_agg de filas crudas) — se agrega para que
-- PedidoCard.jsx pueda mostrar un pill con el resultado de Revisión de
-- envíos (¿la base cargada es compatible con la pieza?) en las listas de
-- Pedidos y Dashboard, sin tener que hacer una query aparte por cada
-- pedido visible. Antes solo se traía en PedidoDetalle.jsx (que usa
-- .select() directo, no esta RPC).
--
-- ⚠️ Esto NO cambia la firma de parámetros de la función — sigue
-- siendo el mismo "create or replace" seguro. El bug documentado en la
-- migración 20260620000000 (Postgres crea una versión nueva en paralelo
-- si cambian los parámetros) NO aplica acá, porque la lista de p_* es
-- idéntica; solo cambia una clave dentro del jsonb_build_object. Por las
-- dudas, después de aplicar esta migración correr igual:
--   select proname, pg_get_function_arguments(oid) from pg_proc
--   where proname = 'listar_pedidos';
-- y confirmar que sigue habiendo una sola fila.
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
        ),
        -- NUEVO: mismo patrón que 'entregable' — filas crudas de
        -- pedido_base para este pedido. PedidoCard.jsx deriva de acá el
        -- "peor resultado" (mismo criterio que peorRevisionDePedido,
        -- ver pedidoBaseResumen en ese archivo) usando resultado_tipo /
        -- resultado_detalle, igual que ya hace con entregable.*
        -- (revision_severidad).
        'pedido_base', (
          select coalesce(jsonb_agg(pb.*), '[]'::jsonb)
          from public.pedido_base pb
          where pb.pedido_id = pg.id
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
-- pedidos/entregable/subtareas/pedido_asignados/profiles/pedido_base tal
-- cual están hoy — no se está creando un atajo que esquive seguridad.
