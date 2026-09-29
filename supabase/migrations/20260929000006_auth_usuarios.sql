-- =====================================================================
-- MIGRACION AUTH: EMPRESAS Y USUARIOS CON SEGURIDAD RLS
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabla empresas (tenants)
CREATE TABLE IF NOT EXISTS public.empresas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  ruc         VARCHAR(13),
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla usuarios
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

-- Indice unico por email en minusculas para prevenir duplicados por case
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_lower_idx ON public.usuarios (lower(email));

-- 3. Habilitar RLS estricto (deny anon y authenticated)
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empresas_service_role_all" ON public.empresas;
CREATE POLICY "empresas_service_role_all" ON public.empresas
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "usuarios_service_role_all" ON public.usuarios;
CREATE POLICY "usuarios_service_role_all" ON public.usuarios
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Semilla inicial de empresa Valwis si no existe
INSERT INTO public.empresas (nombre)
SELECT 'Valwis'
WHERE NOT EXISTS (
  SELECT 1 FROM public.empresas WHERE nombre = 'Valwis'
);
