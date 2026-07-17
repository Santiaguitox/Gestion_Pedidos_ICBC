-- ============================================================================
-- FIX: registrar un pedido en la planilla de Sheets no tenía idempotencia
-- ni marcador, a diferencia de subtareas (que sí tiene registrado_sheet /
-- registrado_sheet_at)
--
-- Síntoma: nada impedía tocar "Registrar pedido en Sheet" dos veces y
-- duplicar la fila en la planilla oficial — el botón seguía visible
-- después de registrar, sin ningún estado que lo reflejara.
--
-- Fix: mismo patrón que ya tiene subtareas — dos columnas en pedidos
-- para marcar que ya se registró y cuándo.
-- ============================================================================

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS registrado_sheet boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS registrado_sheet_at timestamp with time zone;
