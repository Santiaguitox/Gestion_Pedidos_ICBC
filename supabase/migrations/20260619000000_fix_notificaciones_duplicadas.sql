-- ============================================================================
-- FIX: notificaciones duplicadas al asignar un pedido
--
-- Síntoma: al asignar un usuario a un pedido (al crearlo o al editarlo),
-- ese usuario recibía DOS notificaciones casi simultáneas:
--   - "Te asignaron un nuevo pedido: X"  (insertada manualmente desde el
--      frontend, en usePedidos.js)
--   - "Te asignaron al pedido: X"        (insertada por el trigger
--      trg_notif_asignacion en la base, al insertar en pedido_asignados)
--
-- Causa: la misma acción (insert en pedido_asignados) dispara notificación
-- por dos caminos distintos: el trigger de la base, y un insert manual en
-- el frontend. Además, a diferencia de notif_cambio_estado (que sí excluye
-- a quien hizo el cambio), notif_asignacion no excluía a auth.uid(), por lo
-- que autoasignarte un pedido también generaba una notificación para vos
-- mismo.
--
-- Fix: 1) el trigger de la base pasa a ser la única fuente de esta
-- notificación (se elimina el insert manual del lado del frontend, ver
-- usePedidos.js); 2) se corrige notif_asignacion para que no notifique a
-- quien hizo la asignación, igual que ya hace notif_cambio_estado.
-- ============================================================================

create or replace function public.notif_asignacion()
returns trigger
language plpgsql
security definer
as $$
declare
  v_asunto text;
begin
  -- No notificar a quien hizo la asignación (ej: se autoasignó un pedido).
  if NEW.user_id = auth.uid() then
    return NEW;
  end if;

  select asunto into v_asunto from public.pedidos where id = NEW.pedido_id;
  insert into public.notificaciones (user_id, pedido_id, mensaje)
  values (NEW.user_id, NEW.pedido_id, 'Te asignaron al pedido: ' || coalesce(v_asunto, 'sin título'));
  return NEW;
end;
$$;
