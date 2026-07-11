-- Normaliza los tags de pedidos.tags que quedaron duplicados por
-- mayúsculas/minúsculas distintas (ej. "plazo fijo" vs "Plazo Fijo") o
-- por singular/plural (ej. "Feriado" vs "Feriados", "Tarjeta" vs
-- "Tarjetas"), y de paso lleva el resto a un formato consistente
-- (Title Case, preservando las siglas ya en mayúscula como COMEX,
-- BYD, FAL, KYC, EDESA, TC).
--
-- El mapeo de abajo es CURADO A MANO por el dueño del producto revisando
-- el listado completo de tags reales — no es una fórmula automática de
-- Title Case (initcap() de Postgres rompe siglas mixtas como "ICBC Mall"
-- → "Icbc Mall", así que no se usó acá).
--
-- CUIDADO CON updated_at: la tabla tiene el trigger pedidos_updated_at
-- (set_updated_at, ver baseline.sql) que pisa updated_at en CADA UPDATE,
-- incluso si el valor nuevo es idéntico al viejo. Ese campo es el token
-- del lock optimista que usa PedidoForm — un UPDATE sin filtro tocaría
-- TODOS los pedidos y invalidaría el token de cualquiera que tuviera un
-- pedido abierto para editar en ese momento, aunque ese pedido no tuviera
-- ningún tag para corregir. Por eso el WHERE de abajo limita el UPDATE
-- únicamente a las filas que de verdad tienen alguno de los tags viejos.

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
    ('Feriado',                                 'Feriados'),  -- merge singular/plural
    ('feriados',                                'Feriados'),  -- merge singular/plural
    ('hipotecario',                             'Hipotecario'),
    ('icbc club',                               'ICBC Club'),
    ('info regulatoria',                        'Info Regulatoria'),
    ('licitacion',                              'Licitación'),
    ('malware',                                 'Malware'),
    ('modificación templates',                  'Modificación Templates'),
    ('multipay',                                'Multipay'),
    ('Oficial de cuenta',                       'Oficial de Cuenta'),
    ('on',                                      'ON'),        -- merge mayús/minús
    ('onboarding',                              'Onboarding'),
    ('online banking',                          'Online Banking'),
    ('plazo fijo',                              'Plazo Fijo'), -- merge mayús/minús
    ('prestamos',                               'Prestamos'),
    ('recomendados',                            'Recomendados'),
    ('referidos',                               'Referidos'),
    ('retencion yoy',                           'Retencion YOY'),
    ('rotación oficial',                        'Rotación Oficial'),
    ('seguridad',                               'Seguridad'),
    ('sueldos',                                 'Sueldos'),
    ('tarjeta',                                 'Tarjetas'),  -- merge singular/plural
    ('tc',                                      'TC'),
    ('tienda yoy',                              'Tienda YOY'),
    ('upgrade',                                 'Upgrade'),
    ('viajero',                                 'Viajero')
)
update pedidos
set tags = (
  select array_agg(distinct coalesce(m.tag_nuevo, t))
  from unnest(pedidos.tags) as t
  left join mapeo m on m.tag_viejo = t
)
where deleted_at is null
  -- Solo toca filas que realmente tengan alguno de los tags viejos —
  -- ver nota de updated_at arriba.
  and tags && (select array_agg(tag_viejo) from mapeo);

commit;
