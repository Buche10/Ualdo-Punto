-- =====================================================================
-- MIGRACIÓN: NOTA DE CRÉDITO DETALLE Y REINTEGRO TRANSACCIONAL DE STOCK
-- =====================================================================

-- 1. Agregar columna de control de reintegro en comprobantes si no existe
ALTER TABLE public.comprobantes 
ADD COLUMN IF NOT EXISTS stock_reintegrado BOOLEAN NOT NULL DEFAULT false;

-- 2. Crear tabla para persistir las líneas de la Nota de Crédito con producto_id real
CREATE TABLE IF NOT EXISTS public.nota_credito_detalle (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comprobante_id              UUID NOT NULL REFERENCES public.comprobantes(id) ON DELETE CASCADE,
  producto_id                 TEXT NOT NULL,
  codigo_principal            VARCHAR(50),
  descripcion                 VARCHAR(300) NOT NULL,
  cantidad                    NUMERIC(12, 4) NOT NULL,
  precio_unitario             NUMERIC(12, 4) NOT NULL,
  descuento                   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  precio_total_sin_impuesto   NUMERIC(12, 2) NOT NULL,
  codigo_impuesto             VARCHAR(5) NOT NULL DEFAULT '2',
  codigo_porcentaje           VARCHAR(5) NOT NULL,
  tarifa                      NUMERIC(5, 2) NOT NULL,
  valor_iva                   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  stock_reintegrado           BOOLEAN NOT NULL DEFAULT false,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nc_detalle_comprobante ON public.nota_credito_detalle(comprobante_id);

-- Habilitar RLS
ALTER TABLE public.nota_credito_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura nota_credito_detalle autenticado" ON public.nota_credito_detalle 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insertar nota_credito_detalle autenticado" ON public.nota_credito_detalle 
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Servicio total nota_credito_detalle" ON public.nota_credito_detalle 
  FOR ALL TO service_role USING (true);

-- 3. RPC transaccional, idempotente y fail-loud para reintegrar stock al autorizar
CREATE OR REPLACE FUNCTION public.reintegrar_stock_nota_credito(
  p_comprobante_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_comprobante RECORD;
  v_item RECORD;
BEGIN
  -- Bloqueo pesimista de fila del comprobante
  SELECT id, tipo_comprobante, estado, stock_reintegrado
  INTO v_comprobante
  FROM public.comprobantes
  WHERE id = p_comprobante_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMPROBANTE_NO_ENCONTRADO: %', p_comprobante_id;
  END IF;

  IF v_comprobante.tipo_comprobante <> '04' THEN
    RAISE EXCEPTION 'TIPO_COMPROBANTE_INVALIDO: Se esperaba comprobante 04 (Nota de Crédito) pero es %', v_comprobante.tipo_comprobante;
  END IF;

  -- Idempotencia estricta: si ya fue reintegrado, salir exitosamente sin duplicar stock
  IF v_comprobante.stock_reintegrado IS TRUE THEN
    RETURN TRUE;
  END IF;

  -- Fail-loud si el comprobante no está AUTORIZADO por el SRI
  IF v_comprobante.estado <> 'AUTORIZADO' THEN
    RAISE EXCEPTION 'COMPROBANTE_NO_AUTORIZADO: No se puede reintegrar stock de un comprobante en estado %', v_comprobante.estado;
  END IF;

  -- Iterar sobre cada detalle de la nota de crédito y reponer el stock por producto_id real
  FOR v_item IN
    SELECT id, producto_id, cantidad, stock_reintegrado
    FROM public.nota_credito_detalle
    WHERE comprobante_id = p_comprobante_id
    FOR UPDATE
  LOOP
    IF NOT v_item.stock_reintegrado THEN
      PERFORM public.reintegrar_stock(v_item.producto_id, v_item.cantidad);

      UPDATE public.nota_credito_detalle
      SET stock_reintegrado = TRUE
      WHERE id = v_item.id;
    END IF;
  END LOOP;

  -- Marcar comprobante como reintegrado
  UPDATE public.comprobantes
  SET stock_reintegrado = TRUE,
      updated_at = now()
  WHERE id = p_comprobante_id;

  RETURN TRUE;
END;
$$;
