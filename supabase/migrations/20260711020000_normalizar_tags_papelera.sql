-- Normaliza los tags de los pedidos EN PAPELERA (deleted_at not null),
-- que las dos migraciones anteriores (20260711000000 y 20260711010000)
-- saltearon a propósito. El problema de dejarlos afuera: si algún día se
-- restaura un pedido de papelera, reintroduce al selector de tags una
-- variante vieja ya unificada (ej. "plazo fijo" vuelve a convivir con
-- "Plazo Fijo").
--
-- El mapeo es la UNIÓN de los dos anteriores, con las correcciones de la
-- segunda ronda ya aplicadas sobre la primera (ej. acá 'prestamos' va
-- directo a 'Préstamos', sin pasar por el intermedio 'Prestamos').
--
-- updated_at: el trigger pedidos_updated_at pisa updated_at en estas
-- filas también, pero acá no compromete el lock optimista de PedidoForm
-- porque un pedido en papelera no puede estar abierto para edición (la
-- Papelera solo permite restaurar / eliminar definitivo). El WHERE se
-- limita igual a las filas con tags viejos, por prolijidad y para no
-- tocar filas sin necesidad.
--
-- ORDEN DEL ARRAY: a diferencia de las migraciones anteriores (que
-- usaron array_agg(distinct ...) y reordenaron alfabéticamente los tags
-- de las filas tocadas), esta preserva el orden original en que se
-- cargaron: unnest ... WITH ORDINALITY conserva la posición de cada tag,
-- el GROUP BY dedupea los que colapsan en el mismo tag nuevo quedándose
-- con la PRIMERA aparición (min(ord)), y el array_agg final re-arma el
-- array por esa posición. Este es el patrón a copiar si alguna vez hay
-- que normalizar tags de nuevo.

begin;

with mapeo(tag_viejo, tag_nuevo) as (
  values
    ('aapresid',                                'Aapresid'),
    ('access banking',                          'Access Banking'),
    ('activacion yoy',                          'Activación YOY'),
    ('colaboradores independientes',            'Colaboradores Independientes'),
    ('cumple mall',                             'Cumple Mall'),
    ('cvc',                                     'CVC'),
    ('distribuidora de electricidad de salta',  'Distribuidora de Electricidad de Salta'),
    ('edesa',                                   'EDESA'),
    ('Encuesta relacional',                     'Encuesta Relacional'),
    ('Feriado',                                 'Feriados'),
    ('feriados',                                'Feriados'),
    ('hipotecario',                             'Hipotecario'),
    ('icbc club',                               'ICBC Club'),
    ('info regulatoria',                        'Info Regulatoria'),
    ('licitacion',                              'Licitación'),
    ('malware',                                 'Malware'),
    ('modificación templates',                  'Modificación Templates'),
    ('multipay',                                'Multipay'),
    ('Oficial de cuenta',                       'Oficial de Cuenta'),
    ('on',                                      'ON'),
    ('onboarding',                              'Onboarding'),
    ('online banking',                          'Online Banking'),
    ('plazo fijo',                              'Plazo Fijo'),
    ('prestamos',                               'Préstamos'),   -- directo al valor final de la 2da ronda
    ('Prestamos',                               'Préstamos'),
    ('recomendados',                            'Recomendados'),
    ('referidos',                               'Referidos'),
    ('retencion yoy',                           'Retención YOY'), -- ídem
    ('Retencion YOY',                           'Retención YOY'),
    ('rotación oficial',                        'Rotación Oficial'),
    ('seguridad',                               'Seguridad'),
    ('sueldos',                                 'Sueldos'),
    ('tarjeta',                                 'Tarjetas'),
    ('tc',                                      'TC'),
    ('tienda yoy',                              'Tienda YOY'),
    ('upgrade',                                 'Upgrade'),
    ('viajero',                                 'Viajero'),
    ('Agenda_Beneficios',                       'Agenda Beneficios')
)
update pedidos
set tags = (
  select array_agg(s.tag_final order by s.primera_pos)
  from (
    select coalesce(m.tag_nuevo, u.t) as tag_final,
           min(u.ord)                 as primera_pos
    from unnest(pedidos.tags) with ordinality as u(t, ord)
    left join mapeo m on m.tag_viejo = u.t
    group by coalesce(m.tag_nuevo, u.t)
  ) s
)
where deleted_at is not null
  and tags && (select array_agg(tag_viejo) from mapeo);

commit;
