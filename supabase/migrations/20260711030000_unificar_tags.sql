-- ============================================================================
-- UNIFICAR / RENOMBRAR TAGS — solo super_admin, desde Configuración
--
-- Decisión de producto (2026-07-11): las migraciones de normalización de
-- tags fueron una limpieza puntual, pero las variantes van a seguir
-- apareciendo (tildes, mayúsculas, singular/plural). En vez de migración
-- por cada caso, el super_admin tiene en Configuración una herramienta
-- para: renombrar UN tag a como corresponde, o seleccionar VARIOS y
-- unificarlos bajo un nombre final (ej. "Prestamos" + "Préstamos" →
-- "Préstamos"). Renombrar es el caso particular de unificar con 1 tag.
--
-- Va por RPC security definer y no por UPDATE del cliente porque toca
-- pedidos de CUALQUIER usuario (las RLS no contemplan que super_admin
-- edite tags ajenos masivamente) e incluye a propósito los pedidos en
-- PAPELERA — si quedaran afuera, restaurar uno reintroduce la variante
-- vieja al selector (la misma razón de la migración 20260711020000).
--
-- updated_at: el trigger pedidos_updated_at pisa updated_at en cada fila
-- tocada. Acá es comportamiento correcto (la fila realmente cambió: sus
-- tags son otros) y el lock optimista de PedidoForm hace su trabajo si
-- alguien tenía uno de esos pedidos abierto. Lo que SÍ se evita es tocar
-- filas cuyo array no cambiaría: el nombre final se excluye de la lista
-- de viejos, así un pedido que solo tiene el tag final no entra al
-- UPDATE ni pierde su token porque sí.
--
-- ORDEN DEL ARRAY: mismo patrón que 20260711020000 — unnest WITH
-- ORDINALITY + dedup por primera aparición (min(ord)) + re-armado por
-- esa posición. Nunca array_agg(distinct ...), que reordena alfabético.
-- ============================================================================

create or replace function public.unificar_tags(p_tags_viejos text[], p_tag_nuevo text)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nuevo     text := btrim(p_tag_nuevo);
  v_viejos    text[];
  v_afectados integer;
begin
  if public.my_role() is distinct from 'super_admin' then
    raise exception 'Solo super_admin puede unificar tags';
  end if;

  if v_nuevo is null or v_nuevo = '' then
    raise exception 'El nombre final no puede estar vacío';
  end if;

  -- Lista efectiva de tags a reemplazar: sin vacíos/nulls y SIN el
  -- nombre final (si el final es uno de los seleccionados — el caso
  -- típico de unificar — los pedidos que solo tienen ESE no cambian
  -- de contenido y no deben entrar al UPDATE, ver nota de updated_at).
  select array_agg(distinct t)
    into v_viejos
    from unnest(coalesce(p_tags_viejos, '{}'::text[])) as t
   where btrim(coalesce(t, '')) <> ''
     and t <> v_nuevo;

  -- Nada que reemplazar (ej. seleccionó un solo tag y puso el mismo
  -- nombre): no-op explícito, sin tocar ninguna fila.
  if v_viejos is null then
    return 0;
  end if;

  -- Sin filtro de deleted_at: papelera incluida a propósito (ver
  -- cabecera). El && limita a filas que realmente tienen algún viejo.
  update public.pedidos
     set tags = (
       select array_agg(s.tag_final order by s.primera_pos)
       from (
         select case when u.t = any(v_viejos) then v_nuevo else u.t end as tag_final,
                min(u.ord) as primera_pos
         from unnest(pedidos.tags) with ordinality as u(t, ord)
         group by 1
       ) s
     )
   where tags && v_viejos;

  get diagnostics v_afectados = row_count;
  return v_afectados;
end;
$$;

-- El gate real es el my_role() de adentro; el grant solo habilita el
-- transporte para usuarios logueados (mismo criterio que las otras RPC).
grant execute on function public.unificar_tags(text[], text) to authenticated;
