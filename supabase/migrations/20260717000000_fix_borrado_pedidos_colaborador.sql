-- ============================================================================
-- FIX: colaborador podía soft-borrar (y restaurar) cualquier pedido
-- vía API directa
--
-- Síntoma: la policy "pedidos: admin y super_admin actualizan" incluye a
-- colaborador en USING/WITH CHECK (así fue pensada: colaborador SÍ puede
-- editar sus propios pedidos), pero nada protegía las columnas
-- deleted_at/deleted_by — a diferencia de profiles.role, que sí tiene un
-- trigger dedicado (proteger_columnas_sensibles_profiles). Cualquier
-- colaborador con un JWT válido podía hacer
--   UPDATE pedidos SET deleted_at = now() WHERE id = '<cualquier pedido>'
-- sobre un pedido que no le pertenece, y como el SELECT le oculta las
-- filas borradas, el pedido simplemente desaparecía para él sin que la
-- UI (que sí oculta el botón Eliminar a colaborador) lo previniera.
--
-- Fix: mismo patrón que trg_proteger_columnas_sensibles_profiles — un
-- trigger BEFORE UPDATE que rechaza cambios en deleted_at/deleted_by,
-- distinguiendo dos direcciones (decisión de negocio confirmada):
--   - Mandar un pedido a la papelera (deleted_at pasa de vacío a una
--     fecha): permitido a admin Y super_admin — es el botón "Eliminar"
--     que ya ve admin en el detalle del pedido, eso no cambia.
--   - Restaurar (deleted_at pasa de una fecha a vacío) o cualquier otro
--     cambio sobre esas columnas: permitido SOLO a super_admin — admin
--     no debe poder restaurar ni administrar la papelera, ni falta que
--     sepa que existe (ya está oculta en el sidebar, el buscador global
--     y la ruta /papelera; esto cierra el mismo criterio a nivel base).
--
-- De paso, se renombra la policy: decía "admin y super_admin" pero
-- incluye a colaborador — nombre engañoso para auditorías futuras.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.proteger_columnas_sensibles_pedidos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
begin
  if (new.deleted_at is distinct from old.deleted_at)
     or (new.deleted_by is distinct from old.deleted_by) then

    -- Caso permitido a admin: mandar a la papelera (vacío -> fecha).
    -- Cualquier otra dirección (restaurar, o volver a tocar un pedido ya
    -- borrado) requiere super_admin.
    if old.deleted_at is null and new.deleted_at is not null then
      if public.my_role() not in ('super_admin', 'admin') then
        raise exception 'No tenés permisos para eliminar este pedido';
      end if;
    else
      if public.my_role() <> 'super_admin' then
        raise exception 'No tenés permisos para restaurar o modificar el estado de borrado de este pedido';
      end if;
    end if;

  end if;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_proteger_columnas_sensibles_pedidos ON public.pedidos;
CREATE TRIGGER trg_proteger_columnas_sensibles_pedidos
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.proteger_columnas_sensibles_pedidos();

-- Rename: el nombre no reflejaba que colaborador también puede actualizar
-- (a propósito — para sus propios campos editables). USING/WITH CHECK
-- quedan exactamente igual, esto es solo un rename.
ALTER POLICY "pedidos: admin y super_admin actualizan"
  ON public.pedidos
  RENAME TO "pedidos: admin, super_admin y colaborador actualizan";
