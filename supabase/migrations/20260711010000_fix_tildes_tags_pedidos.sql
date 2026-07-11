-- Correcciones puntuales que quedaron pendientes de la migración
-- anterior (20260711000000_normalizar_tags_pedidos.sql): dos tildes
-- que faltaron en el mapeo original, y un tag con guion bajo que se
-- pasa a espacio.
--
-- Mismo cuidado de esa migración: el trigger pedidos_updated_at pisa
-- updated_at en cada UPDATE, así que el WHERE limita el update
-- únicamente a las filas que tienen alguno de estos 3 tags viejos.

begin;

with mapeo(tag_viejo, tag_nuevo) as (
  values
    ('Prestamos',          'Préstamos'),
    ('Retencion YOY',      'Retención YOY'),
    ('Agenda_Beneficios',  'Agenda Beneficios')
)
update pedidos
set tags = (
  select array_agg(distinct coalesce(m.tag_nuevo, t))
  from unnest(pedidos.tags) as t
  left join mapeo m on m.tag_viejo = t
)
where deleted_at is null
  and tags && (select array_agg(tag_viejo) from mapeo);

commit;
