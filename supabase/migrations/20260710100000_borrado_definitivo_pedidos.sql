-- ============================================================================
-- BORRADO DEFINITIVO DE PEDIDOS — solo super_admin, solo desde la papelera
--
-- Hasta acá la papelera solo restauraba: los soft-deleted quedaban para
-- siempre. Decisión de producto (2026-07-10): existe el borrado
-- definitivo, restringido a super_admin y únicamente sobre pedidos que
-- YA están en la papelera (deleted_at not null) — borrar definitivo un
-- pedido activo en un solo paso sería demasiado fácil de tocar por
-- error; el flujo obligado es eliminar (soft) → papelera → definitivo.
--
-- Va por RPC security definer y no por un DELETE del cliente porque:
--   1. Los FKs del baseline hacia pedidos (pedido_asignados, subtareas,
--      entregable, notificaciones, actividad) NO tienen on delete
--      cascade — un DELETE directo falla contra el primer hijo. Acá se
--      borran explícitos, en una sola transacción. Se elige limpiar en
--      la función y NO agregar cascades al esquema: un cascade es
--      global y silencioso; esta lista es visible, auditable y solo
--      corre por este camino.
--   2. Las RLS de las tablas hijas no contemplan que un super_admin
--      borre filas ajenas (ej. notificaciones de otros usuarios) — el
--      security definer las salta, con el permiso validado acá.
--
-- pedido_comentarios (y sus reacciones) y pedido_base ya cascadean por
-- FK — no hace falta tocarlos.
-- ============================================================================

create or replace function public.eliminar_pedido_definitivo(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted_at timestamptz;
  v_existe boolean;
begin
  if public.my_role() is distinct from 'super_admin' then
    raise exception 'Solo super_admin puede eliminar definitivamente';
  end if;

  select deleted_at, true into v_deleted_at, v_existe
    from public.pedidos where id = p_pedido_id;

  if v_existe is not true then
    raise exception 'Pedido inexistente';
  end if;

  -- Solo desde la papelera: el borrado definitivo exige el paso previo
  -- del soft delete. Un pedido activo no se puede volar de un saque.
  if v_deleted_at is null then
    raise exception 'El pedido no está en la papelera';
  end if;

  -- Hijos sin cascade en el baseline, explícitos y a la vista:
  delete from public.pedido_asignados where pedido_id = p_pedido_id;
  delete from public.subtareas        where pedido_id = p_pedido_id;
  delete from public.entregable       where pedido_id = p_pedido_id;
  delete from public.notificaciones   where pedido_id = p_pedido_id;
  delete from public.actividad        where pedido_id = p_pedido_id;

  -- El resto (pedido_comentarios + reacciones, pedido_base) cae por
  -- sus propios on delete cascade al borrar la fila madre:
  delete from public.pedidos where id = p_pedido_id;
end;
$$;
