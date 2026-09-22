-- =====================================================================
-- MIGRACIÓN SRI: RECLAMO ATÓMICO CON SKIP LOCKED Y RESCATE DE JOBS
-- =====================================================================

-- 1. Función para rescatar jobs colgados en estado 'PROCESANDO'
CREATE OR REPLACE FUNCTION public.rescatar_jobs_colgados(p_minutos INT DEFAULT 10)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 2. Función para reclamar jobs pendientes atómicamente con FOR UPDATE SKIP LOCKED
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
SECURITY DEFINER
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

-- 3. Función para reclamar un job específico por ID (evita doble despacho cron ↔ inmediato)
CREATE OR REPLACE FUNCTION public.reclamar_job_por_id(p_job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
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
