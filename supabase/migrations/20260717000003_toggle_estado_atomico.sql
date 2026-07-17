-- ============================================================================
-- FIX: EstadoPopover escribía estados sin lock y sobre base potencialmente
-- vieja ("update perdido")
--
-- Síntoma: a diferencia de actualizarPedido (que sí tiene un lock
-- optimista contra updated_at), el popover de estados hacía
-- read-modify-write sobre pedido.estados de la carga inicial del detalle
-- (que NO tiene realtime, puede tener minutos de antigüedad) y pisaba el
-- array entero sin ningún chequeo. Dos personas toggleando casi al mismo
-- tiempo, o una con la pestaña abierta hace rato, se pisaban los estados
-- del otro en silencio.
--
-- Fix (opción "mejor" del informe, no el parche mínimo de lock): una RPC
-- que aplica los toggles pendientes de forma atómica DENTRO de una
-- transacción con el row lockeado (SELECT ... FOR UPDATE), replicando
-- contra el valor VIGENTE en la base — no contra el snapshot que tenía
-- el cliente. Así no importa cuán vieja esté la pantalla: no hay forma
-- de que se pisen dos escrituras, sin necesitar comparar updated_at.
--
-- p_toggles es la secuencia de estados tocados durante el batch del
-- EstadoPopover (en orden de click) — se replay uno por uno con la
-- MISMA lógica que ya tenía el reducer del frontend (toggle simple,
-- 'finalizado' excluyente con el resto), para no cambiar el
-- comportamiento visible, solo dónde se decide el resultado final.
-- ============================================================================

create or replace function public.aplicar_toggles_estado_pedido(p_pedido_id uuid, p_toggles text[])
returns public.pedidos
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_row public.pedidos;
  v_estados text[];
  v_estado text;
begin
  select * into v_row from public.pedidos where id = p_pedido_id for update;
  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  v_estados := coalesce(v_row.estados, ARRAY[]::text[]);

  foreach v_estado in array coalesce(p_toggles, ARRAY[]::text[])
  loop
    if v_estado = 'finalizado' then
      if 'finalizado' = any(v_estados) then
        v_estados := array_remove(v_estados, 'finalizado');
      else
        v_estados := ARRAY['finalizado'];
      end if;
    else
      if v_estado = any(v_estados) then
        v_estados := array_remove(v_estados, v_estado);
      else
        v_estados := array_remove(v_estados, 'finalizado') || ARRAY[v_estado];
      end if;
    end if;
  end loop;

  -- Si el resultado final es el mismo set que ya había (ej: se activó y
  -- desactivó lo mismo dentro del batch), no se escribe nada — evita un
  -- UPDATE (y su trigger/realtime) sin cambio real.
  if v_estados is not distinct from v_row.estados then
    return v_row;
  end if;

  update public.pedidos set estados = v_estados where id = p_pedido_id
    returning * into v_row;

  return v_row;
end;
$$;

-- security invoker (no definer): corre con los permisos de quien llama,
-- así que sigue exigiendo la policy de UPDATE de pedidos tal cual está
-- hoy (super_admin, admin y colaborador — viewer queda afuera igual que
-- antes, sin necesidad de chequear el rol acá adentro).
grant execute on function public.aplicar_toggles_estado_pedido(uuid, text[]) to authenticated;
