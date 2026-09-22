-- =====================================================================
-- MIGRACIÓN SRI ECUADOR: SEGURIDAD Y ENDURECIMIENTO DE POLÍTICAS RLS
-- =====================================================================
-- Corrige el hallazgo de RLS demasiado abierto (USING (true) para anon)
-- Restringe datos fiscales, comprobantes, clientes y ventas a roles autenticados y backend (service_role).

-- 1. Revocar políticas públicas abiertas en emisor
DROP POLICY IF EXISTS "Lectura pública emisor y puntos" ON public.emisor;
CREATE POLICY "Lectura emisor autenticado" ON public.emisor 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Servicio total emisor" ON public.emisor 
  FOR ALL TO service_role USING (true);

-- 2. Revocar políticas públicas en establecimientos y puntos
DROP POLICY IF EXISTS "Lectura establecimientos" ON public.establecimientos;
DROP POLICY IF EXISTS "Lectura puntos_emision" ON public.puntos_emision;
CREATE POLICY "Lectura establecimientos autenticado" ON public.establecimientos 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lectura puntos_emision autenticado" ON public.puntos_emision 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Servicio total establecimientos" ON public.establecimientos 
  FOR ALL TO service_role USING (true);
CREATE POLICY "Servicio total puntos_emision" ON public.puntos_emision 
  FOR ALL TO service_role USING (true);

-- 3. Blindar datos personales (PII) en clientes
DROP POLICY IF EXISTS "Lectura clientes" ON public.clientes;
DROP POLICY IF EXISTS "Insertar clientes" ON public.clientes;
DROP POLICY IF EXISTS "Actualizar clientes" ON public.clientes;

CREATE POLICY "Lectura clientes autenticado" ON public.clientes 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insertar clientes autenticado" ON public.clientes 
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Actualizar clientes autenticado" ON public.clientes 
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Servicio total clientes" ON public.clientes 
  FOR ALL TO service_role USING (true);

-- 4. Blindar ventas y detalles
DROP POLICY IF EXISTS "Lectura ventas" ON public.ventas;
DROP POLICY IF EXISTS "Insertar ventas" ON public.ventas;
DROP POLICY IF EXISTS "Lectura venta_detalle" ON public.venta_detalle;
DROP POLICY IF EXISTS "Insertar venta_detalle" ON public.venta_detalle;

CREATE POLICY "Lectura ventas autenticado" ON public.ventas 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insertar ventas autenticado" ON public.ventas 
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Lectura venta_detalle autenticado" ON public.venta_detalle 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insertar venta_detalle autenticado" ON public.venta_detalle 
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Servicio total ventas" ON public.ventas 
  FOR ALL TO service_role USING (true);
CREATE POLICY "Servicio total venta_detalle" ON public.venta_detalle 
  FOR ALL TO service_role USING (true);

-- 5. Blindar comprobantes fiscales inmutables
DROP POLICY IF EXISTS "Lectura comprobantes" ON public.comprobantes;

CREATE POLICY "Lectura comprobantes autenticado" ON public.comprobantes 
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Servicio total comprobantes" ON public.comprobantes 
  FOR ALL TO service_role USING (true);
