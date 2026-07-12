-- ============================================================================
-- ESTADÍSTICAS — solo admin/super_admin
--
-- Dos piezas:
--
-- 1. estadisticas_config: fila única con las FECHAS DE CORTE del histórico.
--    * stats_desde: desde cuándo son confiables las métricas basadas en el
--      log de actividad (lead time, throughput de finalizados, % a tiempo).
--      Se calcula EN ESTA MIGRACIÓN como el primer evento cambio_estado
--      registrado — created_at existió siempre, pero "finalizados" solo es
--      reconstruible desde que el log existe; sin este piso, el gráfico de
--      throughput mostraría acumulación de backlog FALSA en períodos viejos
--      (creados completos vs. finalizados incompletos).
--    * reprog_desde: desde cuándo se registran los cambios de fecha_limite
--      (tipo 'reprogramacion' en actividad — lo agrega usePedidos.js en el
--      mismo deploy que esta migración). Métrica nueva = nace en cero: se
--      fija en la fecha en que corre esta migración. Cada card del front
--      muestra su propio "datos desde" cuando el rango pedido empieza antes
--      (patrón por-métrica, pensado para que futuras métricas declaren su
--      propio nacimiento sin tocar las demás).
--
-- 2. estadisticas_periodo(): función de agregación que devuelve TODO el
--    payload de la pantalla en un solo jsonb (un RPC, no doce). Decisiones:
--    * security definer + chequeo de rol ADENTRO (my_role() in admin/super):
--      ocultar el link del menú no protege nada — cualquiera puede llamar
--      un RPC a mano; el permiso real vive acá. Mismo patrón que
--      eliminar_pedido_definitivo (20260710100000).
--    * "Finalizado" = la ÚLTIMA transición HACIA 'finalizado' en el log
--      ('finalizado' aparece en nuevos y no estaba en anteriores), y solo
--      si el pedido SIGUE finalizado hoy — un pedido finalizado, reabierto
--      y re-finalizado cuenta una vez, por su última finalización; uno
--      reabierto y aún abierto no cuenta.
--    * "Espera del cliente" = suma de los tramos entre eventos cambio_estado
--      en los que 'esperando_respuesta' quedó activo (el estado vigente
--      entre el evento i y el i+1 es el `nuevos` del evento i), con tope en
--      la finalización. Es una reconstrucción del log, no un cronómetro:
--      exacta mientras los cambios de estado se registren al momento.
--    * Comparación vs. período anterior: NO se resuelve acá — el cliente
--      llama dos veces con rangos distintos. Mantiene la función simple y
--      el rango anterior explícito en la UI.
-- ============================================================================

-- ── 1. Config ───────────────────────────────────────────────────────────────

create table if not exists public.estadisticas_config (
  -- Singleton: primary key booleana con check true = imposible una 2da fila.
  id boolean primary key default true check (id),
  stats_desde  date not null,
  reprog_desde date not null
);

alter table public.estadisticas_config enable row level security;

-- Legible solo por los roles que pueden ver la pantalla (el front la lee
-- para mostrar "datos desde" y limitar el date picker).
drop policy if exists estadisticas_config_select on public.estadisticas_config;
create policy estadisticas_config_select on public.estadisticas_config
  for select using (public.my_role() = any (array['super_admin', 'admin']));
-- Sin policies de insert/update/delete: solo se toca por migración.

insert into public.estadisticas_config (stats_desde, reprog_desde)
select
  -- Primer cambio_estado logueado = inicio del histórico confiable. Si la
  -- tabla actividad estuviera vacía (instalación desde cero), arranca hoy.
  coalesce(
    (select min(a.created_at)::date from public.actividad a where a.tipo = 'cambio_estado'),
    current_date
  ),
  current_date
on conflict (id) do nothing;

-- ── 2. Función de agregación ────────────────────────────────────────────────

create or replace function public.estadisticas_periodo(
  p_desde date default null,          -- null → últimos 30 días
  p_hasta date default null,          -- null → hoy
  p_tipo text default null,           -- filtros globales opcionales
  p_instancia text default null,
  p_usuario_id uuid default null,     -- filtra por asignación (pedido_asignados)
  p_dias_estancado int default 7      -- umbral de "sin movimiento"
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

  -- Normalización del rango: tope en hoy, piso en stats_desde (ver header).
  v_hasta := least(coalesce(p_hasta, current_date), current_date);
  v_desde := greatest(coalesce(p_desde, v_hasta - 29), v_stats_desde);
  if v_desde > v_hasta then
    v_desde := v_hasta;
  end if;

  -- Granularidad honesta según el largo del rango: los buckets del
  -- throughput no deben ser ni 90 barras diarias ni 2 barras mensuales.
  v_dias := (v_hasta - v_desde) + 1;
  v_gran := case
    when v_dias <= 21  then 'day'
    when v_dias <= 120 then 'week'
    else 'month'
  end;

  with
  -- Pedidos no borrados que pasan los filtros globales. TODAS las métricas
  -- salen de acá para que los filtros apliquen parejo en toda la pantalla.
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
  -- Última transición HACIA finalizado, solo de pedidos que siguen
  -- finalizados hoy (ver criterio en el header).
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
  -- Timeline de estados por pedido finalizado: cada evento "rige" hasta el
  -- siguiente (lead()); esperando = si dejó activo esperando_respuesta.
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
  -- Pedidos finalizados DENTRO del período, con su lead time desglosado.
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
  -- Buckets del throughput (day/week/month según v_gran), completos aunque
  -- estén en cero — un gráfico con semanas faltantes miente visualmente.
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
  produccion as (
    select
      pr.id,
      pr.full_name,
      coalesce(fz.n, 0) as finalizados,
      coalesce(st.n, 0) as subtareas
    from public.profiles pr
    left join (
      select pa.user_id, count(*) as n
      from lead_fin lf
      join public.pedido_asignados pa on pa.pedido_id = lf.pedido_id
      group by pa.user_id
    ) fz on fz.user_id = pr.id
    left join (
      select s.asignado_a as user_id, count(*) as n
      from public.subtareas s
      join pf p on p.id = s.pedido_id
      where s.completada
        and s.completada_at is not null
        and s.completada_at::date between v_desde and v_hasta
        and s.asignado_a is not null
      group by s.asignado_a
    ) st on st.user_id = pr.id
    where coalesce(fz.n, 0) + coalesce(st.n, 0) > 0
  ),
  -- Último movimiento de cada pedido ACTIVO: máxima marca entre creación,
  -- actividad y comentarios. Lo que quedó atrás de p_dias_estancado, se
  -- reporta como estancado.
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
      -- true si el rango pedido empezaba antes del histórico y se recortó —
      -- el front lo usa para el aviso "datos disponibles desde…".
      'recortado', (p_desde is not null and p_desde < v_stats_desde)
    ),
    'kpis', jsonb_build_object(
      'creados', (select count(*) from pf p where p.created_at::date between v_desde and v_hasta),
      'finalizados', (select count(*) from lead_fin),
      'lead_promedio', (select round(avg(lf.dias_total)::numeric, 1) from lead_fin lf),
      'lead_mediana', (select round((percentile_cont(0.5) within group (order by lf.dias_total))::numeric, 1) from lead_fin lf),
      -- % a tiempo solo sobre finalizados CON fecha límite; n_con_fecha
      -- acompaña para que el front muestre el N y el número sea honesto.
      'pct_a_tiempo', (select round(100.0 * avg((lf.finalizado_en::date <= lf.fecha_limite)::int), 0)
                         from lead_fin lf where lf.fecha_limite is not null),
      'n_con_fecha', (select count(*) from lead_fin lf where lf.fecha_limite is not null),
      -- Emails por fecha_programacion (la fecha del envío real), no por
      -- creación del pedido — es lo que responde "cuánto salió este mes".
      'emails_enviados', (select coalesce(sum(p.cantidad_envios), 0) from pf p
                            where p.fecha_programacion between v_desde and v_hasta),
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
    'cumplimiento_mensual', (
      select coalesce(jsonb_agg(t.x order by (t.x ->> 'mes')), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'mes', to_char(date_trunc('month', lf.finalizado_en), 'YYYY-MM'),
          'pct', round(100.0 * avg((lf.finalizado_en::date <= lf.fecha_limite)::int), 0),
          'total', count(*)
        ) as x
        from lead_fin lf
        where lf.fecha_limite is not null
        group by date_trunc('month', lf.finalizado_en)
      ) t
    ),
    'produccion', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', pd.id, 'nombre', pd.full_name,
        'finalizados', pd.finalizados, 'subtareas', pd.subtareas
      ) order by pd.finalizados desc, pd.subtareas desc), '[]'::jsonb)
      from produccion pd
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
          'asignados', coalesce((
            select jsonb_agg(jsonb_build_object('user_id', pr.id, 'nombre', pr.full_name))
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

-- Mismo criterio que el resto de los RPC: ejecutable solo por sesiones
-- autenticadas (el chequeo fino de rol ya está adentro de la función).
revoke all on function public.estadisticas_periodo(date, date, text, text, uuid, int) from public;
grant execute on function public.estadisticas_periodo(date, date, text, text, uuid, int) to authenticated;
