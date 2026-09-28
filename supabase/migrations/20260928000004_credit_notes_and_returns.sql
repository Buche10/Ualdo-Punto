-- =====================================================================
-- MIGRACIÓN: NOTAS DE CRÉDITO Y REINTEGRO ATÓMICO DE STOCK
-- =====================================================================

-- 1. Función atómica para reintegrar stock en devoluciones
CREATE OR REPLACE FUNCTION public.reintegrar_stock(
  p_producto_id TEXT,
  p_cantidad NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_data JSONB;
  v_stock_actual NUMERIC;
  v_nuevo_stock NUMERIC;
BEGIN
  -- Bloqueo pesimista de fila para prevenir condiciones de carrera
  SELECT data INTO v_data
  FROM public.products
  WHERE id = p_producto_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCTO_NO_ENCONTRADO: %', p_producto_id;
  END IF;

  v_stock_actual := COALESCE((v_data->>'theoreticalStock')::NUMERIC, 0);
  v_nuevo_stock := v_stock_actual + p_cantidad;
  v_data := jsonb_set(v_data, '{theoreticalStock}', to_jsonb(v_nuevo_stock));

  UPDATE public.products
  SET data = v_data,
      updated_at = now()
  WHERE id = p_producto_id;

  RETURN v_nuevo_stock;
END;
$$;

-- 2. Asegurar soporte de secuencial '04' (Nota de Crédito) para 001-001
INSERT INTO public.secuenciales (tipo_doc, cod_establecimiento, cod_punto_emision, ultimo_secuencial)
VALUES ('04', '001', '001', 0)
ON CONFLICT (tipo_doc, cod_establecimiento, cod_punto_emision) DO NOTHING;
