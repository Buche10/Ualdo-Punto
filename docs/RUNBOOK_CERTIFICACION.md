# Runbook de Certificación y Paso a Producción SRI

Este documento describe el procedimiento normativo para certificar comprobantes electrónicos de **PharmaStock** ante el Servicio de Rentas Internas (SRI) del Ecuador y realizar el corte definitivo a producción.

---

## 1. Prerrequisitos Obligatorios

Antes de emitir comprobantes legales en producción, obtenga los siguientes elementos:

1. **Certificado de Firma Electrónica (.p12 / .pfx):**
   - Emitido por una entidad de certificación acreditada en Ecuador (Banco Central del Ecuador, Security Data, Consejo de la Judicatura, ANF, Uanataca).
   - Archivo `.p12` y su respectiva contraseña.
   - **IMPORTANTE:** Nunca guarde el archivo `.p12` ni la clave en el repositorio de Git.

2. **Datos Fiscales del Emisor:**
   - Número de RUC (13 dígitos, terminado en `001`).
   - Razón Social registrada en el RUC.
   - Dirección Matriz y Dirección de Establecimiento.
   - Condición tributaria: `obligadoContabilidad` (`SI` o `NO`).
   - Leyenda de régimen: `CONTRIBUYENTE RÉGIMEN RIMPE` o `CONTRIBUYENTE RÉGIMEN GENERAL`.

3. **Ambiente de Pruebas SRI Habilitado:**
   - La empresa debe tener habilitada la emisión electrónica en pruebas en el portal SRI en Línea.

---

## 2. Fase de Pruebas y Certificación (Ambiente '1')

### 2.1 Configuración de Variables de Entorno

Configure en su archivo `apps/sri-backend/.env`:

```env
PORT=3001
SRI_AMBIENTE=1
SRI_P12_PATH=C:/ruta/segura/a/su_firma.p12
SRI_P12_PASSWORD=clave_de_su_firma
SRI_RUC_EMISOR=1790016919001
SRI_REQUIRE_DB=false
POS_API_KEY=pharmastock-pos-secure-key-2026
```

### 2.2 Ejecución del Harness de Certificación

Ejecute el guion de certificación oficial con todos los casos exigidos por el SRI:

```bash
npm run certificacion
```

El script validará automáticamente:
- **CASO-01:** Factura a Consumidor Final (< $50.00).
- **CASO-02:** Factura con Cédula (Medicamentos 0% IVA).
- **CASO-03:** Factura a Sociedad con RUC (Bienes generales 15% IVA).
- **CASO-04:** Factura Mixta (Medicamento 0% + Bienes 15% + Descuento por línea).

Cada XML generado se somete a validación contra las reglas oficiales de orden de elementos y precisión del XSD del SRI (v2.1.0). Los artefactos se guardan en `scripts/output/`.

---

## 3. Procedimiento para Paso a Producción (Ambiente '2')

### 3.1 Solicitud en el Portal SRI en Línea

1. Ingrese con el RUC y clave a [SRI en Línea](https://srienlinea.sri.gob.ec).
2. Diríjase a: **Facturación Electrónica**, luego **Producción** y **Autorización**.
3. Solicite la emisión en ambiente de producción. La aprobación suele ser inmediata para contribuyentes al día con sus obligaciones.

### 3.2 Corte de Configuración en el Servidor

Modifique las variables en el entorno de producción (`.env` del servidor):

```env
SRI_AMBIENTE=2
SRI_REQUIRE_DB=true
SRI_P12_PATH=/etc/secrets/firma_produccion.p12
SRI_P12_PASSWORD=password_produccion
SUPABASE_URL=https://su-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=su_service_role_key_secreta
POS_API_KEY=su_api_key_estacion_pos
```

> **Principio de Blindaje Fiscal:** Con `SRI_REQUIRE_DB=true`, el sistema rechaza cualquier emisión si la base de datos PostgreSQL/Supabase no está disponible, impidiendo desincronizaciones de stock o pérdida de comprobantes legales.

### 3.3 Smoke Test Controlado en Producción

1. En el frontend POS (pestaña **Facturar**), realice una venta controlada de prueba:
   - Producto de bajo valor ($1.00 - $2.00).
   - Cliente con RUC o Cédula propia.
2. Presione **Emitir Factura Electrónica**.
3. Confirme que el estado cambie a **AUTORIZADO**.
4. Descargue el RIDE en PDF y verifique que incluya:
   - Clave de acceso de 49 dígitos.
   - Número y fecha de autorización válida.
   - Código de barras y desglose tributario exacto.
5. Ingrese a SRI en Línea, sección **Facturación Electrónica**, **Consultas**, y verifique la factura emitida.
