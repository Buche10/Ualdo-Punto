-- =====================================================================
-- MIGRACIÓN SRI ECUADOR: MODELO DE FACTURACIÓN ELECTRÓNICA Y AUDITORÍA
-- =====================================================================

-- Extensión para generación de UUID si no está activa
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. TABLA: emisor (Datos de la Farmacia / Contribuyente)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emisor (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruc                     VARCHAR(13) NOT NULL UNIQUE,
  razon_social            VARCHAR(300) NOT NULL,
  nombre_comercial        VARCHAR(300),
  dir_matriz              VARCHAR(300) NOT NULL,
  dir_establecimiento     VARCHAR(300) NOT NULL,
  contribuyente_especial  VARCHAR(13),
  obligado_contabilidad   VARCHAR(2) NOT NULL DEFAULT 'NO' CHECK (obligado_contabilidad IN ('SI', 'NO')),
  regimen_rimpe           VARCHAR(100), -- ej. 'CONTRIBUYENTE RÉGIMEN RIMPE'
  ambiente                CHAR(1) NOT NULL DEFAULT '1' CHECK (ambiente IN ('1', '2')), -- 1: Pruebas, 2: Producción
  tipo_emision            CHAR(1) NOT NULL DEFAULT '1' CHECK (tipo_emision IN ('1')),   -- 1: Normal
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. TABLAS: establecimientos y puntos de emisión
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.establecimientos (
  codigo      CHAR(3) PRIMARY KEY, -- '001'
  nombre      VARCHAR(150) NOT NULL,
  direccion   VARCHAR(300) NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.puntos_emision (
  codigo                  CHAR(3) NOT NULL, -- '001'
  establecimiento_codigo  CHAR(3) NOT NULL REFERENCES public.establecimientos(codigo),
  nombre                  VARCHAR(150) NOT NULL,
  activo                  BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (establecimiento_codigo, codigo)
);

-- Insertar establecimiento y punto de emisión por defecto si no existen
INSERT INTO public.establecimientos (codigo, nombre, direccion)
VALUES ('001', 'Matriz Farmacia', 'Dirección Principal')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.puntos_emision (codigo, establecimiento_codigo, nombre)
VALUES ('001', '001', 'Punto de Venta Caja 1')
ON CONFLICT (establecimiento_codigo, codigo) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3. TABLA: secuenciales (Control transaccional anti-colisión)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.secuenciales (
  tipo_doc            CHAR(2) NOT NULL, -- '01': Factura, '04': Nota de Crédito
  cod_establecimiento CHAR(3) NOT NULL,
  cod_punto_emision   CHAR(3) NOT NULL,
  ultimo_secuencial   INTEGER NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tipo_doc, cod_establecimiento, cod_punto_emision),
  FOREIGN KEY (cod_establecimiento, cod_punto_emision) 
    REFERENCES public.puntos_emision(establecimiento_codigo, codigo)
);

-- Inicializar secuencial de facturas para 001-001
INSERT INTO public.secuenciales (tipo_doc, cod_establecimiento, cod_punto_emision, ultimo_secuencial)
VALUES ('01', '001', '001', 0)
ON CONFLICT (tipo_doc, cod_establecimiento, cod_punto_emision) DO NOTHING;

-- ---------------------------------------------------------------------
-- Función Atómica: Obtener Siguiente Secuencial con Bloqueo Exclusivo
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
  -- Bloqueo de fila para concurrencia estricta (SELECT FOR UPDATE)
  SELECT ultimo_secuencial + 1
  INTO v_siguiente
  FROM public.secuenciales
  WHERE tipo_doc = p_tipo_doc
    AND cod_establecimiento = p_estab
    AND cod_punto_emision = p_pto_emi
  FOR UPDATE;

  -- Si no existía registro previo, insertamos el primer valor
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

  -- Formatear a 9 dígitos con ceros a la izquierda
  RETURN LPAD(v_siguiente::TEXT, 9, '0');
END;
$$;

-- ---------------------------------------------------------------------
-- 4. TABLA: clientes
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

-- Crear Consumidor Final predeterminado
INSERT INTO public.clientes (tipo_identificacion, identificacion, razon_social, direccion, email)
VALUES ('07', '9999999999999', 'CONSUMIDOR FINAL', 'ECUADOR', '')
ON CONFLICT (identificacion) DO NOTHING;

-- ---------------------------------------------------------------------
-- 5. TABLAS: ventas y venta_detalle
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
  codigo_porcentaje           VARCHAR(5) NOT NULL, -- '0' (0%), '4' (15%)
  tarifa                      NUMERIC(5, 2) NOT NULL, -- 0.00, 15.00
  valor_iva                   NUMERIC(12, 2) NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------
-- 6. TABLA: comprobantes (Auditoría Fiscal Inmutable)
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
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comprobantes_clave_acceso ON public.comprobantes(clave_acceso);
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado ON public.comprobantes(estado);

-- ---------------------------------------------------------------------
-- 7. TABLA: sri_jobs (Cola de Envíos y Reintentos Asíncronos)
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
-- 8. TABLA: sri_logs (Auditoría de Transacciones SOAP)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sri_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comprobante_id    UUID REFERENCES public.comprobantes(id) ON DELETE SET NULL,
  metodo            VARCHAR(50) NOT NULL, -- 'RECEPCION' o 'AUTORIZACION'
  endpoint          TEXT NOT NULL,
  request_payload   TEXT,
  response_payload  TEXT,
  status_code       INTEGER,
  tiempo_ms         INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 9. PERMISOS Y ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------
ALTER TABLE public.emisor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.establecimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puntos_emision ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secuenciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprobantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sri_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sri_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura para front-end (clave pública / autenticada)
CREATE POLICY "Lectura pública emisor y puntos" ON public.emisor FOR SELECT USING (true);
CREATE POLICY "Lectura establecimientos" ON public.establecimientos FOR SELECT USING (true);
CREATE POLICY "Lectura puntos_emision" ON public.puntos_emision FOR SELECT USING (true);
CREATE POLICY "Lectura clientes" ON public.clientes FOR SELECT USING (true);
CREATE POLICY "Insertar clientes" ON public.clientes FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualizar clientes" ON public.clientes FOR UPDATE USING (true);

CREATE POLICY "Lectura ventas" ON public.ventas FOR SELECT USING (true);
CREATE POLICY "Insertar ventas" ON public.ventas FOR INSERT WITH CHECK (true);

CREATE POLICY "Lectura venta_detalle" ON public.venta_detalle FOR SELECT USING (true);
CREATE POLICY "Insertar venta_detalle" ON public.venta_detalle FOR INSERT WITH CHECK (true);

CREATE POLICY "Lectura comprobantes" ON public.comprobantes FOR SELECT USING (true);

-- Solo service_role (backend NestJS) puede actualizar comprobantes, modificar secuenciales y ejecutar jobs
CREATE POLICY "Backend acceso total comprobantes" ON public.comprobantes FOR ALL TO service_role USING (true);
CREATE POLICY "Backend acceso total secuenciales" ON public.secuenciales FOR ALL TO service_role USING (true);
CREATE POLICY "Backend acceso total sri_jobs" ON public.sri_jobs FOR ALL TO service_role USING (true);
CREATE POLICY "Backend acceso total sri_logs" ON public.sri_logs FOR ALL TO service_role USING (true);
