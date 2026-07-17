-- ============================================================================
-- FIX: notif_aprobacion no excluía al actor
--
-- Síntoma: un asignado que aprueba una pieza entregable recibe él mismo
-- la notificación "Pieza aprobada en ...", además de los demás asignados.
--
-- Causa: notif_asignacion y notif_cambio_estado sí excluyen a auth.uid()
-- (ver 20260619000000 y la versión vigente en 20260708000000), pero
-- notif_aprobacion quedó afuera de ese mismo criterio cuando se escribió.
--
-- Fix: recrear notif_aprobacion (sobre la versión vigente, la de
-- 20260708000000_notificaciones_agrupadas.sql) saltando la notificación
-- cuando el asignado a notificar es quien hizo el cambio.
-- ============================================================================

create or replace function public.notif_aprobacion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_asunto text;
  v_asignado record;
begin
  if OLD.aprobado = false and NEW.aprobado = true then
    select asunto into v_asunto from public.pedidos where id = NEW.pedido_id;
    for v_asignado in
      select user_id from public.pedido_asignados where pedido_id = NEW.pedido_id
    loop
      -- No notificar a quien aprobó la pieza (mismo criterio que ya
      -- aplican notif_asignacion y notif_cambio_estado).
      if v_asignado.user_id != auth.uid() then
        perform public.crear_notificacion(
          v_asignado.user_id,
          NEW.pedido_id,
          'Pieza aprobada en "' || v_asunto || '": ' || NEW.nombre_pieza,
          'aprobacion',
          jsonb_build_object('asunto', v_asunto, 'pieza', NEW.nombre_pieza)
        );
      end if;
    end loop;
  end if;
  return NEW;
end;
$$;
