-- ============================================================================
-- FIX: filtro de tag (p_tag) quedaba atado a la ventana de 30 días /
-- ocultamiento de finalizados del modo 'normal', a diferencia de la
-- búsqueda por texto (p_busqueda) que YA ignoraba todo eso.
--
-- Síntoma reportado: filtrar por el tag "Plazo Fijo" en el dropdown
-- traía MENOS resultados que buscar "Plazo Fijo" por texto en el
-- buscador (que matchea tags vía ilike, entre otras cosas) — mismo
-- término, dos caminos distintos, resultados distintos.
--
-- Causa: el WHERE de listar_pedidos tenía dos ramas excluyentes:
--   - p_busqueda IS NOT NULL  → ignora modo/ventana, busca en todo.
--   - p_busqueda IS NULL      → aplica la ventana de tiempo del modo
--                                actual (últimos 30 días en 'normal',
--                                excluyendo finalizados salvo que el
--                                switch "mostrar finalizados" esté
--                                prendido).
-- p_tag se aplicaba como un AND aparte (correcto, sigue igual), pero
-- si no había búsqueda de TEXTO, igual caía en la segunda rama y
-- quedaba acotado a esos últimos 30 días — aunque el pedido con ese
-- tag fuera de hace 6 meses, o ya estuviera finalizado.
--
-- Fix: filtrar por tag es, conceptualmente, la misma intención que
-- buscar por texto — "quiero ver TODO lo que tiene esto", no "lo que
-- tiene esto Y ADEMÁS es reciente". Se agrega p_tag a la condición que
-- bypasea la ventana temporal, igual que ya hacía p_busqueda. El
-- chequeo real de que el tag matchee sigue siendo el mismo AND de
-- siempre (no se toca) — este cambio solo saca la restricción de
-- fecha/finalizados cuando hay un tag elegido.
--
-- Misma firma de parámetros que la versión anterior (20260625000000) —
-- create or replace seguro, no genera una función duplicada.
-- ============================================================================

create or replace function public.listar_pedidos(
  p_modo text default 'normal',
  p_dias_normal int default 30,
  p_vence_desde date default null,
  p_vence_hasta date default null,
  p_busqueda text default null,
  p_prioridad text default null,
  p_tipo text default null,
  p_estado text default null,
  p_tag text default null,
  p_usuario_id uuid default null,
  p_mostrar_finalizados boolean default false,
  p_pagina int default 0,
  p_pagina_size int default 30,
  p_solo_id uuid default null
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
        -- Búsqueda por texto O filtro de tag: ambos ignoran el modo de
        -- rango temporal y el ocultamiento de finalizados — el filtro
        -- de tag ya exige el match real más arriba (and p_tag = any(...)),
        -- acá solo se está sacando la restricción de fecha para que no
        -- se acumule con esa condición.
        ((p_busqueda is not null or p_tag is not null) and (
          p_busqueda is null or (
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
          )
        ))
        or
        -- Ni búsqueda de texto ni tag: aplica el modo de rango temporal
        (p_busqueda is null and p_tag is null and (
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
