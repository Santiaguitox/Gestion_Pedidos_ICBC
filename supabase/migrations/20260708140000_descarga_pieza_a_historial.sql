-- ============================================================================
-- SUMAR LA DESCARGA DE PIEZAS AL HISTORIAL DEL PEDIDO (tabla actividad)
--
-- Las notificaciones se pueden borrar (o borrarse solas/por error), así
-- que además de avisar por push a los admin/super_admin asignados,
-- dejamos constancia permanente en 'actividad' — el mismo historial
-- que ya se ve en el acordeón de detalle del pedido (PedidoHistorial.jsx).
--
-- A diferencia del aviso (que solo llega si hay admin/super_admin
-- asignados a ese pedido puntual), el registro en 'actividad' se
-- guarda SIEMPRE que se descargue algo — son dos cosas independientes:
-- una es "avisar a alguien", la otra es "dejar constancia de que pasó".
--
-- Se hace acá adentro (mismo auth.uid() ya resuelto en la función, no
-- un user_id mandado por el frontend) para que quede con la misma
-- fuente de verdad confiable que ya tiene el aviso.
-- ============================================================================

create or replace function public.notificar_descarga_pieza(
  p_pedido_id uuid,
  p_piezas text[],
  p_tipo_descarga text default 'individual'
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nombre_usuario text;
  v_asunto text;
  v_que text;
  v_mensaje text;
  v_asignado record;
begin
  select full_name into v_nombre_usuario from public.profiles where id = auth.uid();
  select asunto into v_asunto from public.pedidos where id = p_pedido_id;

  v_que := case
    when p_tipo_descarga = 'zip' then
      'el ZIP con ' || coalesce(array_length(p_piezas, 1), 0) || ' pieza' ||
      (case when coalesce(array_length(p_piezas, 1), 0) = 1 then '' else 's' end) ||
      ' (' || array_to_string(p_piezas, ', ') || ')'
    else
      'el HTML de "' || coalesce(p_piezas[1], 'una pieza') || '"'
  end;

  v_mensaje := coalesce(v_nombre_usuario, 'Un usuario') || ' descargó ' || v_que ||
    ' en "' || coalesce(v_asunto, 'sin título') || '"';

  -- Aviso (push + in-app) — solo a admin/super_admin asignados a este pedido.
  for v_asignado in
    select pa.user_id
    from public.pedido_asignados pa
    join public.profiles pr on pr.id = pa.user_id
    where pa.pedido_id = p_pedido_id
      and pr.role in ('admin', 'super_admin')
  loop
    if v_asignado.user_id != auth.uid() then
      perform public.crear_notificacion(
        v_asignado.user_id,
        p_pedido_id,
        v_mensaje,
        'descarga',
        jsonb_build_object(
          'asunto', v_asunto,
          'usuario_id', auth.uid(),
          'usuario_nombre', v_nombre_usuario,
          'tipo_descarga', p_tipo_descarga,
          'piezas', to_jsonb(p_piezas),
          'descargado_at', now()
        )
      );
    end if;
  end loop;

  -- Historial del pedido — siempre, haya o no alguien a quien avisarle.
  insert into public.actividad (pedido_id, user_id, tipo, detalle)
  values (
    p_pedido_id,
    auth.uid(),
    'descarga_pieza',
    jsonb_build_object('tipo_descarga', p_tipo_descarga, 'piezas', to_jsonb(p_piezas))
  );
end;
$$;

grant execute on function public.notificar_descarga_pieza(uuid, text[], text) to authenticated;
