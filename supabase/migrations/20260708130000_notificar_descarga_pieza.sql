-- ============================================================================
-- NOTIFICAR DESCARGA DE PIEZAS POR PARTE DE UN VIEWER
--
-- Problema: los usuarios con rol 'viewer' (el cliente) pueden descargar
-- el HTML de una pieza o el ZIP de todas las piezas de un pedido, sin
-- que quede ningún registro de que eso pasó. El equipo se enteraba de
-- que el cliente ya tenía el material porque se lo pedían por otro
-- canal al aprobar — ahora que lo pueden bajar directo, el equipo puede
-- no enterarse nunca y el pedido queda sin marcarse como finalizado.
--
-- La descarga en sí es 100% client-side (arma un Blob en el navegador,
-- ver src/lib/descargarPiezas.js) — no hay ningún INSERT/UPDATE en la
-- base que dispare un trigger para engancharse. Por eso esto NO es un
-- trigger como notif_aprobacion/notif_cambio_estado: es una función
-- que el frontend llama explícitamente (vía supabase.rpc) apenas
-- termina una descarga exitosa hecha por un viewer.
--
-- Destinatarios: solo admin/super_admin asignados a ESE pedido — los
-- colaboradores asignados no reciben esta notificación (piden que no
-- les interesa este dato puntual).
--
-- security definer: necesario para poder leer profiles.role de otros
-- usuarios (filtro de destinatarios) sin depender de qué le permita
-- ver RLS a un viewer, y para que la fuente de verdad de "quién
-- descargó" sea auth.uid() resuelto en el servidor — el frontend NUNCA
-- manda quién es, así no se puede falsear el nombre en el aviso.
-- ============================================================================

alter table public.notificaciones
  drop constraint if exists notificaciones_tipo_check;

alter table public.notificaciones
  add constraint notificaciones_tipo_check
  check (tipo in ('cambio_estado', 'asignacion', 'aprobacion', 'vencimiento', 'sistema', 'descarga'));

-- p_piezas: nombres (o link, si la pieza no tiene nombre) de lo que se
-- descargó. p_tipo_descarga: 'individual' (un link puntual, puede ser
-- más de uno si se descargan de a uno varias veces) o 'zip' (botón
-- "Descargar todas").
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
end;
$$;

grant execute on function public.notificar_descarga_pieza(uuid, text[], text) to authenticated;
