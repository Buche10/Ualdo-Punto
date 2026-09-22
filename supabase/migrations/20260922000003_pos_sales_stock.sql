-- =====================================================================
-- MIGRACIÓN POS: DESCUENTO ATÓMICO DE STOCK Y TRANSACCIÓN DE VENTA
-- =====================================================================

-- 1. Función atómica para descontar stock de la tabla products (data JSONB)
CREATE OR REPLACE FUNCTION public.descontar_stock(
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

  IF v_stock_actual < p_cantidad THEN
    RAISE EXCEPTION 'STOCK_INSUFICIENTE: Producto % tiene stock % pero se solicitaron %', 
      p_producto_id, v_stock_actual, p_cantidad;
  END IF;

  v_nuevo_stock := v_stock_actual - p_cantidad;
  v_data := jsonb_set(v_data, '{theoreticalStock}', to_jsonb(v_nuevo_stock));

  UPDATE public.products
  SET data = v_data,
      updated_at = now()
  WHERE id = p_producto_id;

  RETURN v_nuevo_stock;
END;
$$;

-- 2. Función transaccional integral para registrar venta y descontar stock
CREATE OR REPLACE FUNCTION public.procesar_venta_pos(
  p_cliente JSONB,
  p_items JSONB,
  p_totales JSONB,
  p_forma_pago VARCHAR(10) DEFAULT '01'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cliente_id UUID;
  v_venta_id UUID;
  v_item JSONB;
  v_subtotal_0 NUMERIC;
  v_subtotal_15 NUMERIC;
  v_total_descuento NUMERIC;
  v_total_iva NUMERIC;
  v_importe_total NUMERIC;
BEGIN
  -- A. Registrar o actualizar cliente
  SELECT id INTO v_cliente_id
  FROM public.clientes
  WHERE identificacion = p_cliente->>'identificacion';

  IF NOT FOUND THEN
    INSERT INTO public.clientes (
      tipo_identificacion,
      identificacion,
      razon_social,
      direccion,
      telefono,
      email
    ) VALUES (
      p_cliente->>'tipoIdentificacion',
      p_cliente->>'identificacion',
      p_cliente->>'razonSocial',
      p_cliente->>'direccion',
      p_cliente->>'telefono',
      p_cliente->>'email'
    )
    RETURNING id INTO v_cliente_id;
  END IF;

  v_subtotal_0 := COALESCE((p_totales->>'subtotal0')::NUMERIC, 0);
  v_subtotal_15 := COALESCE((p_totales->>'subtotal15')::NUMERIC, 0);
  v_total_descuento := COALESCE((p_totales->>'totalDescuento')::NUMERIC, 0);
  v_total_iva := COALESCE((p_totales->>'totalIva')::NUMERIC, 0);
  v_importe_total := COALESCE((p_totales->>'importeTotal')::NUMERIC, 0);

  -- B. Insertar cabecera de venta
  INSERT INTO public.ventas (
    cliente_id,
    subtotal_0,
    subtotal_15,
    total_descuento,
    total_iva,
    importe_total,
    forma_pago_codigo,
    estado
  ) VALUES (
    v_cliente_id,
    v_subtotal_0,
    v_subtotal_15,
    v_total_descuento,
    v_total_iva,
    v_importe_total,
    p_forma_pago,
    'COMPLETADA'
  )
  RETURNING id INTO v_venta_id;

  -- C. Procesar cada ítem: descontar stock atómicamente e insertar detalle
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Descontar stock (lanza excepción y causa rollback si stock insuficiente)
    PERFORM public.descontar_stock(
      v_item->>'productoId',
      (v_item->>'cantidad')::NUMERIC
    );

    INSERT INTO public.venta_detalle (
      venta_id,
      producto_id,
      codigo_principal,
      descripcion,
      cantidad,
      precio_unitario,
      descuento,
      precio_total_sin_impuesto,
      codigo_impuesto,
      codigo_porcentaje,
      tarifa,
      valor_iva
    ) VALUES (
      v_venta_id,
      v_item->>'productoId',
      v_item->>'codigo',
      v_item->>'descripcion',
      (v_item->>'cantidad')::NUMERIC,
      (v_item->>'precioUnitario')::NUMERIC,
      COALESCE((v_item->>'descuento')::NUMERIC, 0),
      (v_item->>'precioTotalSinImpuesto')::NUMERIC,
      COALESCE(v_item->>'codigoImpuesto', '2'),
      COALESCE(v_item->>'codigoPorcentaje', '0'),
      COALESCE((v_item->>'tarifa')::NUMERIC, 0),
      COALESCE((v_item->>'valorIva')::NUMERIC, 0)
    );
  END LOOP;

  RETURN v_venta_id;
END;
$$;
