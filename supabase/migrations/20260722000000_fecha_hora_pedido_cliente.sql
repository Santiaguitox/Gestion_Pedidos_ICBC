-- ============================================================================
-- Nuevas columnas: fecha_pedido_cliente / hora_pedido_cliente
--
-- Motivo: con la carga de trabajo del equipo, a veces un pedido no se
-- carga en la app apenas lo manda el cliente, sino más tarde (a veces
-- días después). Hasta ahora, al registrar el pedido en el Google
-- Sheet, el campo "Fecha/hora pedido" se autocompletaba siempre con
-- pedidos.created_at (cuándo se CARGÓ en la app) — quedando "atrasado"
-- respecto a cuándo el cliente realmente lo pidió.
--
-- Estas dos columnas son opcionales: si quien crea/edita el pedido
-- carga la fecha/hora real (ver checkbox nuevo en PedidoForm), el
-- modal de "Registrar en Sheet" las usa en vez de created_at. Si no se
-- cargan, el comportamiento queda exactamente igual que antes (usa
-- created_at) — ver SheetModal.jsx.
--
-- Mismo patrón que fecha_programacion/hora_programacion ya existentes
-- en esta tabla: date + text (no timestamptz), nullable, sin default.
-- ============================================================================

alter table public.pedidos
  add column if not exists fecha_pedido_cliente date,
  add column if not exists hora_pedido_cliente text;
