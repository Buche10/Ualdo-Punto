-- =====================================================================
-- ESQUEMA CONSOLIDADO POSTGRESQL PURO - UALDO NEGOCIOS / SRI BACKEND
-- =====================================================================
-- Este archivo define la estructura completa de base de datos para PostgreSQL
-- estandar (sin dependencias ni extensiones propietarias de Supabase).
--
-- ARQUITECTURA DE SEGURIDAD:
-- El acceso a la base de datos se realiza EXCLUSIVAMENTE desde el backend
-- NestJS (apps/sri-backend) mediante conexion TCP/SSL parametrizada.
-- No se requiere ni aplican roles 'anon', 'authenticated' ni 'service_role'
-- de Supabase, ni politicas de Row Level Security (RLS) dependientes de
-- dichos roles. Se recomienda configurar un rol de aplicacion con privilegios
-- minimos requeridos sobre el esquema public (CONNECT, SELECT, INSERT, UPDATE,
-- EXECUTE) y nunca conectar en runtime como superusuario (postgres).
-- =====================================================================

-- Extension para generacion de identificadores UUID v4
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. TABLA: products (Catalogo y Stock Maestro)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id         TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. TABLA: batches (Lotes de Medicamentos / Productos)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.batches (
  id         TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batches_product_id ON public.batches (product_id);

-- ---------------------------------------------------------------------
-- 3. TABLA: emisor (Datos Fiscales de la Empresa Emisora SRI)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emisor (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruc                    VARCHAR(13) NOT NULL UNIQUE,
  razon_social           VARCHAR(300) NOT NULL,
  nombre_comercial       VARCHAR(300),
  dir_matriz             VARCHAR(300) NOT NULL,
  dir_establecimiento    VARCHAR(300) NOT NULL,
  contribuyente_especial VARCHAR(13),
  obligado_contabilidad  VARCHAR(2) NOT NULL DEFAULT 'NO' CHECK (obligado_contabilidad IN ('SI', 'NO')),
  regimen_rimpe          VARCHAR(100),
  ambiente               CHAR(1) NOT NULL DEFAULT '1' CHECK (ambiente IN ('1', '2')),
  tipo_emision           CHAR(1) NOT NULL DEFAULT '1' CHECK (tipo_emision IN ('1')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 4. TABLAS: establecimientos y puntos_emision
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.establecimientos (
  codigo      CHAR(3) PRIMARY KEY,
  nombre      VARCHAR(150) NOT NULL,
  direccion   VARCHAR(300) NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.puntos_emision (
  codigo                 CHAR(3) NOT NULL,
  establecimiento_codigo CHAR(3) NOT NULL REFERENCES public.establecimientos(codigo),
  nombre                 VARCHAR(150) NOT NULL,
  activo                 BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (establecimiento_codigo, codigo)
);

-- ---------------------------------------------------------------------
-- 5. TABLA: secuenciales (Control Transaccional de Secuenciales SRI)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.secuenciales (
  tipo_doc            CHAR(2) NOT NULL,
  cod_establecimiento CHAR(3) NOT NULL,
  cod_punto_emision   CHAR(3) NOT NULL,
  ultimo_secuencial   INTEGER NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tipo_doc, cod_establecimiento, cod_punto_emision),
  FOREIGN KEY (cod_establecimiento, cod_punto_emision) 
    REFERENCES public.puntos_emision(establecimiento_codigo, codigo)
);

-- ---------------------------------------------------------------------
-- 6. TABLA: clientes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clientes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_identificacion CHAR(2) NOT NULL CHECK (tipo_identificacion IN ('04', '05', '06', '07', '08')),
  identificacion      VARCHAR(20) NOT NULL UNIQUE,
  razon_social        VARCHAR(300) NOT NULL,
  direccion           VARCHAR(300),
  telefono            VARCHAR(30),
  email               VARCHAR(150),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 7. TABLAS DE AUTENTICACION Y MULTI-TENANCY: empresas y usuarios
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.empresas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  ruc         VARCHAR(13),
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.usuarios (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  nombre         TEXT,
  rol            VARCHAR(20) NOT NULL DEFAULT 'operador' CHECK (rol IN ('admin', 'operador')),
  activo         BOOLEAN NOT NULL DEFAULT true,
  ultimo_acceso  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email_lower ON public.usuarios (lower(email));

-- ---------------------------------------------------------------------
-- 8. TABLAS: ventas y venta_detalle
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ventas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          UUID NOT NULL REFERENCES public.clientes(id),
  subtotal_0          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal_15         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal_no_objeto  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal_exento     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_descuento     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_iva           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  propina             NUMERIC(12, 2) NOT NULL DEFAULT 0,
  importe_total       NUMERIC(12, 2) NOT NULL,
  forma_pago_codigo   VARCHAR(10) NOT NULL DEFAULT '01',
  estado              VARCHAR(20) NOT NULL DEFAULT 'COMPLETADA',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.venta_detalle (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id                    UUID NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  producto_id                 TEXT NOT NULL,
  codigo_principal            VARCHAR(50) NOT NULL,
  descripcion                 VARCHAR(300) NOT NULL,
  cantidad                    NUMERIC(12, 4) NOT NULL,
  precio_unitario             NUMERIC(12, 4) NOT NULL,
  descuento                   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  precio_total_sin_impuesto   NUMERIC(12, 2) NOT NULL,
  codigo_impuesto             VARCHAR(5) NOT NULL DEFAULT '2',
  codigo_porcentaje           VARCHAR(5) NOT NULL,
  tarifa                      NUMERIC(5, 2) NOT NULL,
  valor_iva                   NUMERIC(12, 2) NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------
-- 9. TABLA: comprobantes (Auditoria Fiscal Inmutable)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comprobantes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id            UUID REFERENCES public.ventas(id),
  tipo_comprobante    CHAR(2) NOT NULL DEFAULT '01',
  clave_acceso        CHAR(49) NOT NULL UNIQUE,
  establecimiento     CHAR(3) NOT NULL DEFAULT '001',
  punto_emision       CHAR(3) NOT NULL DEFAULT '001',
  secuencial          CHAR(9) NOT NULL,
  estado              VARCHAR(30) NOT NULL DEFAULT 'GENERADO' 
                      CHECK (estado IN ('GENERADO', 'FIRMADO', 'ENVIADO', 'RECIBIDA', 'AUTORIZADO', 'DEVUELTA', 'NO_AUTORIZADO', 'EN_CONTINGENCIA', 'ANULADO')),
  xml_generado        TEXT,
  xml_firmado         TEXT,
  num_autorizacion    VARCHAR(49),
  fecha_autorizacion  TIMESTAMPTZ,
  mensajes_sri        JSONB NOT NULL DEFAULT '[]'::jsonb,
  stock_reintegrado   BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comprobantes_clave_acceso ON public.comprobantes(clave_acceso);
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado ON public.comprobantes(estado);

-- ---------------------------------------------------------------------
-- 10. TABLA: sri_jobs (Cola de Envios y Reintentos Asincronos)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sri_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comprobante_id  UUID NOT NULL REFERENCES public.comprobantes(id) ON DELETE CASCADE,
  tipo_tarea      VARCHAR(50) NOT NULL DEFAULT 'ENVIAR_Y_AUTORIZAR',
  estado          VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'PROCESANDO', 'EXITOSO', 'FALLIDO')),
  intentos        INTEGER NOT NULL DEFAULT 0,
  max_intentos    INTEGER NOT NULL DEFAULT 5,
  proximo_intento TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_error    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sri_jobs_worker ON public.sri_jobs(estado, proximo_intento) 
WHERE estado = 'PENDIENTE';

-- ---------------------------------------------------------------------
-- 11. TABLA: sri_logs (Auditoria de Transacciones SOAP con SRI)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sri_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comprobante_id    UUID REFERENCES public.comprobantes(id) ON DELETE SET NULL,
  metodo            VARCHAR(50) NOT NULL,
  endpoint          TEXT NOT NULL,
  request_payload   TEXT,
  response_payload  TEXT,
  status_code       INTEGER,
  tiempo_ms         INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 12. TABLA: nota_credito_detalle (Lineas de NC para Reintegro Real)
-- ---------------------------------------------------------------------
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

-- =====================================================================
-- FUNCIONES PL/PGSQL DEL SISTEMA FISCAL
-- =====================================================================

-- ---------------------------------------------------------------------
-- F1. Funcion: obtener_siguiente_secuencial
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.obtener_siguiente_secuencial(
  p_tipo_doc CHAR(2),
  p_estab CHAR(3),
  p_pto_emi CHAR(3)
)
RETURNS VARCHAR(9)
LANGUAGE plpgsql
AS $$
DECLARE
  v_siguiente INT;
BEGIN
  SELECT ultimo_secuencial + 1
  INTO v_siguiente
  FROM public.secuenciales
  WHERE tipo_doc = p_tipo_doc
    AND cod_establecimiento = p_estab
    AND cod_punto_emision = p_pto_emi
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.secuenciales (tipo_doc, cod_establecimiento, cod_punto_emision, ultimo_secuencial)
    VALUES (p_tipo_doc, p_estab, p_pto_emi, 1);
    v_siguiente := 1;
  ELSE
    UPDATE public.secuenciales
    SET ultimo_secuencial = v_siguiente,
        updated_at = now()
    WHERE tipo_doc = p_tipo_doc
      AND cod_establecimiento = p_estab
      AND cod_punto_emision = p_pto_emi;
  END IF;

  RETURN LPAD(v_siguiente::TEXT, 9, '0');
END;
$$;

-- ---------------------------------------------------------------------
-- F2. Funcion: rescatar_jobs_colgados
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rescatar_jobs_colgados(p_minutos INT DEFAULT 10)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_rescatados INT;
BEGIN
  UPDATE public.sri_jobs
  SET estado = 'PENDIENTE',
      updated_at = now()
  WHERE estado = 'PROCESANDO'
    AND updated_at < (now() - (p_minutos || ' minutes')::interval);

  GET DIAGNOSTICS v_rescatados = ROW_COUNT;
  RETURN v_rescatados;
END;
$$;

-- ---------------------------------------------------------------------
-- F3. Funcion: reclamar_jobs_pendientes (FOR UPDATE SKIP LOCKED)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reclamar_jobs_pendientes(p_limite INT DEFAULT 10)
RETURNS TABLE (
  id UUID,
  comprobante_id UUID,
  intentos INT,
  max_intentos INT,
  clave_acceso CHAR(49),
  xml_firmado TEXT,
  estado_comprobante VARCHAR(30)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH seleccionados AS (
    SELECT j.id AS job_id
    FROM public.sri_jobs j
    WHERE j.estado = 'PENDIENTE'
      AND j.proximo_intento <= now()
    ORDER BY j.proximo_intento ASC
    LIMIT p_limite
    FOR UPDATE SKIP LOCKED
  ),
  actualizados AS (
    UPDATE public.sri_jobs j
    SET estado = 'PROCESANDO',
        updated_at = now()
    FROM seleccionados s
    WHERE j.id = s.job_id
    RETURNING j.id, j.comprobante_id, j.intentos, j.max_intentos
  )
  SELECT 
    a.id,
    a.comprobante_id,
    a.intentos,
    a.max_intentos,
    c.clave_acceso,
    c.xml_firmado,
    c.estado AS estado_comprobante
  FROM actualizados a
  JOIN public.comprobantes c ON c.id = a.comprobante_id;
END;
$$;

-- ---------------------------------------------------------------------
-- F4. Funcion: reclamar_job_por_id
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reclamar_job_por_id(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_filas INT;
BEGIN
  UPDATE public.sri_jobs
  SET estado = 'PROCESANDO',
      updated_at = now()
  WHERE id = p_job_id
    AND estado = 'PENDIENTE';

  GET DIAGNOSTICS v_filas = ROW_COUNT;
  RETURN (v_filas > 0);
END;
$$;

-- ---------------------------------------------------------------------
-- F5. Funcion: descontar_stock
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.descontar_stock(
  p_producto_id TEXT,
  p_cantidad NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_data JSONB;
  v_stock_actual NUMERIC;
  v_nuevo_stock NUMERIC;
BEGIN
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

-- ---------------------------------------------------------------------
-- F6. Funcion: reintegrar_stock
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reintegrar_stock(
  p_producto_id TEXT,
  p_cantidad NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_data JSONB;
  v_stock_actual NUMERIC;
  v_nuevo_stock NUMERIC;
BEGIN
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

-- ---------------------------------------------------------------------
-- F7. Funcion: procesar_venta_pos
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.procesar_venta_pos(
  p_cliente JSONB,
  p_items JSONB,
  p_totales JSONB,
  p_forma_pago VARCHAR(10) DEFAULT '01'
)
RETURNS UUID
LANGUAGE plpgsql
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
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

-- ---------------------------------------------------------------------
-- F8. Funcion: reintegrar_stock_nota_credito
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reintegrar_stock_nota_credito(
  p_comprobante_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_comprobante RECORD;
  v_item RECORD;
BEGIN
  SELECT id, tipo_comprobante, estado, stock_reintegrado
  INTO v_comprobante
  FROM public.comprobantes
  WHERE id = p_comprobante_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMPROBANTE_NO_ENCONTRADO: %', p_comprobante_id;
  END IF;

  IF v_comprobante.tipo_comprobante <> '04' THEN
    RAISE EXCEPTION 'TIPO_COMPROBANTE_INVALIDO: Se esperaba comprobante 04 (Nota de Credito) pero es %', v_comprobante.tipo_comprobante;
  END IF;

  IF v_comprobante.stock_reintegrado IS TRUE THEN
    RETURN TRUE;
  END IF;

  IF v_comprobante.estado <> 'AUTORIZADO' THEN
    RAISE EXCEPTION 'COMPROBANTE_NO_AUTORIZADO: No se puede reintegrar stock de un comprobante en estado %', v_comprobante.estado;
  END IF;

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

  UPDATE public.comprobantes
  SET stock_reintegrado = TRUE,
      updated_at = now()
  WHERE id = p_comprobante_id;

  RETURN TRUE;
END;
$$;

-- =====================================================================
-- SEMILLAS Y DATOS BASE
-- =====================================================================

INSERT INTO public.establecimientos (codigo, nombre, direccion)
VALUES ('001', 'Matriz Ualdo Negocios', 'Direccion Principal')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.puntos_emision (codigo, establecimiento_codigo, nombre)
VALUES ('001', '001', 'Punto de Venta Caja 1')
ON CONFLICT (establecimiento_codigo, codigo) DO NOTHING;

INSERT INTO public.secuenciales (tipo_doc, cod_establecimiento, cod_punto_emision, ultimo_secuencial)
VALUES ('01', '001', '001', 0)
ON CONFLICT (tipo_doc, cod_establecimiento, cod_punto_emision) DO NOTHING;

INSERT INTO public.secuenciales (tipo_doc, cod_establecimiento, cod_punto_emision, ultimo_secuencial)
VALUES ('04', '001', '001', 0)
ON CONFLICT (tipo_doc, cod_establecimiento, cod_punto_emision) DO NOTHING;

INSERT INTO public.clientes (tipo_identificacion, identificacion, razon_social, direccion, email)
VALUES ('07', '9999999999999', 'CONSUMIDOR FINAL', 'ECUADOR', '')
ON CONFLICT (identificacion) DO NOTHING;

INSERT INTO public.empresas (nombre)
SELECT 'Valwis'
WHERE NOT EXISTS (
  SELECT 1 FROM public.empresas WHERE nombre = 'Valwis'
);
