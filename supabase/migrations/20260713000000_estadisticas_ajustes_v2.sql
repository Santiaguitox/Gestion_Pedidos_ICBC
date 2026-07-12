-- ============================================================================
-- ESTADÍSTICAS — ajuste v2 (2026-07-12), reemplaza por completo a
-- estadisticas_periodo() de la migración 20260712000000.
--
-- Cambios de este ajuste, todos por feedback directo tras probar en local:
--   1. Se quita 'emails_enviados' de los KPIs — no hay certeza de que
--      cantidad_envios sea el dato real de envíos (decisión de producto,
--      no técnica). Si en el futuro se confirma una fuente confiable,
--      se vuelve a agregar.
--   2. Se quita 'cumplimiento_mensual' entero (la card "Cumplimiento de
--      fecha límite por mes" no se consideró práctica).
--   3. Se quita 'produccion' entero (la card "Producción por persona" se
--      saca de la pantalla).
--   4. BUG REAL CORREGIDO: 'estancados' ahora trae avatar_color de cada
--      asignado. profiles.avatar_color es un color elegido a mano por el
--      usuario (ver Usuarios.jsx) que pisa al hash automático en TODOS
--      los componentes existentes de la app (patrón `avatar_color ||
--      colorAvatar(id)` — PedidoCard, ComentariosSection, BuscadorGlobal,
--      CargaTrabajoModal, etc.). La v1 de esta función no lo traía, así
--      que el front caía siempre al hash automático — por eso el usuario
--      con avatar_color verde guardado a mano se veía celeste acá y
--      correcto en el resto de la app. Bug de esta función, no de
--      colorAvatar() ni de la paleta.
-- ============================================================================

create or replace function public.estadisticas_periodo(
  p_desde date default null,
  p_hasta date default null,
  p_tipo text default null,
  p_instancia text default null,
  p_usuario_id uuid default null,
  p_dias_estancado int default 7
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_stats_desde  date;
  v_reprog_desde date;
  v_desde date;
  v_hasta date;
  v_dias  int;
  v_gran  text;
  v_resultado jsonb;
begin
  if public.my_role() is distinct from 'super_admin'
     and public.my_role() is distinct from 'admin' then
    raise exception 'Solo admin o super_admin pueden consultar estadísticas';
  end if;

  select c.stats_desde, c.reprog_desde
    into v_stats_desde, v_reprog_desde
    from public.estadisticas_config c
    limit 1;
  v_stats_desde  := coalesce(v_stats_desde,  current_date);
  v_reprog_desde := coalesce(v_reprog_desde, current_date);

  v_hasta := least(coalesce(p_hasta, current_date), current_date);
  v_desde := greatest(coalesce(p_desde, v_hasta - 29), v_stats_desde);
  if v_desde > v_hasta then
    v_desde := v_hasta;
  end if;

  v_dias := (v_hasta - v_desde) + 1;
  v_gran := case
    when v_dias <= 21  then 'day'
    when v_dias <= 120 then 'week'
    else 'month'
  end;

  with
  pf as (
    select p.*
    from public.pedidos p
    where p.deleted_at is null
      and (p_tipo is null or p.tipo = p_tipo)
      and (p_instancia is null or p.instancia = p_instancia)
      and (p_usuario_id is null or exists (
        select 1 from public.pedido_asignados pa
        where pa.pedido_id = p.id and pa.user_id = p_usuario_id
      ))
  ),
  fin as (
    select distinct on (a.pedido_id)
      a.pedido_id,
      a.created_at as finalizado_en
    from public.actividad a
    join pf p on p.id = a.pedido_id
    where a.tipo = 'cambio_estado'
      and coalesce(a.detalle -> 'nuevos' ? 'finalizado', false)
      and not coalesce(a.detalle -> 'anteriores' ? 'finalizado', false)
      and 'finalizado' = any (p.estados)
    order by a.pedido_id, a.created_at desc
  ),
  eventos as (
    select
      a.pedido_id,
      a.created_at,
      coalesce(a.detalle -> 'nuevos' ? 'esperando_respuesta', false) as esperando,
      lead(a.created_at) over (partition by a.pedido_id order by a.created_at) as siguiente
    from public.actividad a
    join fin f on f.pedido_id = a.pedido_id
    where a.tipo = 'cambio_estado'
  ),
  espera as (
    select
      e.pedido_id,
      sum(
        extract(epoch from (
          least(coalesce(e.siguiente, f.finalizado_en), f.finalizado_en) - e.created_at
        )) / 86400.0
      ) as dias
    from eventos e
    join fin f on f.pedido_id = e.pedido_id
    where e.esperando
      and e.created_at < f.finalizado_en
    group by e.pedido_id
  ),
  lead_fin as (
    select
      f.pedido_id,
      p.tipo,
      p.fecha_limite,
      f.finalizado_en,
      extract(epoch from (f.finalizado_en - p.created_at)) / 86400.0 as dias_total,
      coalesce(es.dias, 0) as dias_espera
    from fin f
    join pf p on p.id = f.pedido_id
    left join espera es on es.pedido_id = f.pedido_id
    where f.finalizado_en::date between v_desde and v_hasta
  ),
  buckets as (
    select distinct date_trunc(v_gran, d)::date as bucket
    from generate_series(v_desde::timestamp, v_hasta::timestamp, interval '1 day') d
  ),
  serie as (
    select
      b.bucket,
      (select count(*) from pf p
        where p.created_at::date between v_desde and v_hasta
          and date_trunc(v_gran, p.created_at)::date = b.bucket) as creados,
      (select count(*) from lead_fin lf
        where date_trunc(v_gran, lf.finalizado_en)::date = b.bucket) as finalizados
    from buckets b
  ),
  ult_mov as (
    select
      p.id,
      p.asunto,
      greatest(
        p.created_at,
        coalesce((select max(a.created_at) from public.actividad a where a.pedido_id = p.id), p.created_at),
        coalesce((select max(c.created_at) from public.pedido_comentarios c where c.pedido_id = p.id), p.created_at)
      ) as ultimo
    from pf p
    where not ('finalizado' = any (p.estados))
  ),
  reprog as (
    select a.pedido_id, count(*) as n
    from public.actividad a
    join pf p on p.id = a.pedido_id
    where a.tipo = 'reprogramacion'
      and a.created_at::date between v_desde and v_hasta
    group by a.pedido_id
  )
  select jsonb_build_object(
    'meta', jsonb_build_object(
      'desde', v_desde,
      'hasta', v_hasta,
      'granularidad', v_gran,
      'stats_desde', v_stats_desde,
      'reprog_desde', v_reprog_desde,
      'recortado', (p_desde is not null and p_desde < v_stats_desde)
    ),
    'kpis', jsonb_build_object(
      'creados', (select count(*) from pf p where p.created_at::date between v_desde and v_hasta),
      'finalizados', (select count(*) from lead_fin),
      'lead_promedio', (select round(avg(lf.dias_total)::numeric, 1) from lead_fin lf),
      'lead_mediana', (select round((percentile_cont(0.5) within group (order by lf.dias_total))::numeric, 1) from lead_fin lf),
      'pct_a_tiempo', (select round(100.0 * avg((lf.finalizado_en::date <= lf.fecha_limite)::int), 0)
                         from lead_fin lf where lf.fecha_limite is not null),
      'n_con_fecha', (select count(*) from lead_fin lf where lf.fecha_limite is not null),
      'activos_hoy', (select count(*) from pf p where not ('finalizado' = any (p.estados)))
    ),
    'throughput', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'bucket', s.bucket, 'creados', s.creados, 'finalizados', s.finalizados
      ) order by s.bucket), '[]'::jsonb)
      from serie s
    ),
    'lead_por_tipo', (
      select coalesce(jsonb_agg(t.x order by (t.x ->> 'total')::numeric desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'tipo', lf.tipo,
          'total', round(avg(lf.dias_total)::numeric, 1),
          'espera', round(avg(lf.dias_espera)::numeric, 1),
          'interno', round(greatest(avg(lf.dias_total) - avg(lf.dias_espera), 0)::numeric, 1),
          'n', count(*)
        ) as x
        from lead_fin lf
        group by lf.tipo
      ) t
    ),
    'distribucion_tipo', (
      select coalesce(jsonb_agg(t.x order by (t.x ->> 'n')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object('tipo', p.tipo, 'n', count(*)) as x
        from pf p
        where p.created_at::date between v_desde and v_hasta
        group by p.tipo
      ) t
    ),
    'distribucion_instancia', (
      select coalesce(jsonb_agg(t.x order by (t.x ->> 'n')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object('instancia', coalesce(p.instancia, 'sin_instancia'), 'n', count(*)) as x
        from pf p
        where p.created_at::date between v_desde and v_hasta
        group by coalesce(p.instancia, 'sin_instancia')
      ) t
    ),
    'top_tags', (
      select coalesce(jsonb_agg(t.x order by (t.x ->> 'n')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object('tag', tg, 'n', count(*)) as x
        from pf p, unnest(p.tags) tg
        where p.created_at::date between v_desde and v_hasta
        group by tg
        order by count(*) desc
        limit 8
      ) t
    ),
    'estancados', (
      select coalesce(jsonb_agg(t.x order by (t.x ->> 'dias')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', u.id,
          'asunto', u.asunto,
          'dias', (current_date - u.ultimo::date),
          -- avatar_color viaja acá: ver nota del bug en el header.
          'asignados', coalesce((
            select jsonb_agg(jsonb_build_object(
              'user_id', pr.id, 'nombre', pr.full_name, 'avatar_color', pr.avatar_color
            ))
            from public.pedido_asignados pa
            join public.profiles pr on pr.id = pa.user_id
            where pa.pedido_id = u.id
          ), '[]'::jsonb)
        ) as x
        from ult_mov u
        where u.ultimo < now() - make_interval(days => p_dias_estancado)
        order by u.ultimo asc
        limit 10
      ) t
    ),
    'reprogramaciones', jsonb_build_object(
      'total', (select coalesce(sum(r.n), 0) from reprog r),
      'top', (
        select coalesce(jsonb_agg(t.x order by (t.x ->> 'n')::int desc), '[]'::jsonb)
        from (
          select jsonb_build_object('id', p.id, 'asunto', p.asunto, 'n', r.n) as x
          from reprog r
          join pf p on p.id = r.pedido_id
          order by r.n desc
          limit 5
        ) t
      )
    )
  )
  into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.estadisticas_periodo(date, date, text, text, uuid, int) from public;
grant execute on function public.estadisticas_periodo(date, date, text, text, uuid, int) to authenticated;
