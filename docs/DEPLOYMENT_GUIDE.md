# Guía de Despliegue en Producción — Backend SRI & Worker PharmaStock

Esta guía detalla el procedimiento paso a paso para desplegar el backend NestJS con su worker 24/7 en plataformas Cloud (Render, Railway, Fly.io) o en un VPS propio con Docker Compose, conectándolo con el frontend en Netlify y la base de datos Supabase.

---

## 1. Arquitectura de Despliegue

```
[ Frontend: Netlify ]
   (Vite + React)
        │
        ▼ HTTPS
[ Backend SRI + Worker 24/7 ] ──(SOAP / HTTPS)──► [ SRI Web Services ]
   (NestJS en Render/Railway/VPS)                     (Celcer / Cel)
        │
        ▼ SSL / TLS
[ Supabase PostgreSQL ]
  (Comprobantes, Jobs, Stock)
```

- **Backend API:** Expone endpoints REST protegidos por API Key (`/api/invoices`, `/api/credit-notes`, `/api/sales`, `/api/health`).
- **Worker de Cola SRI:** Ejecutado en el mismo proceso de NestJS, monitorea la tabla `sri_jobs` cada 5 segundos para reintentos exponenciales, rescate de jobs huérfanos y notificación por correo.
- **Probe de Salud:** `GET /api/health` (público para balanceadores y monitores de uptime).

---

## 2. Preparación de Secretos

NUNCA incluya el archivo `.p12` ni claves en el repositorio Git.

### 2.1 Convertir el certificado .p12 a Base64

Para plataformas como Render, Railway o Fly.io que gestionan secretos mediante variables de entorno, convierta su archivo `.p12` a una cadena Base64:

- **En Windows (PowerShell):**
  ```powershell
  [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\a\su_firma.p12")) | Set-Clipboard
  ```
  *(La cadena queda copiada en el portapapeles)*

- **En Linux / macOS:**
  ```bash
  base64 -w 0 su_firma.p12 | pbcopy
  # O en Linux:
  base64 -w 0 su_firma.p12 | xclip -selection clipboard
  ```

### 2.2 Variables de Entorno Requeridas

| Variable | Tipo | Descripción | Ejemplo / Valor |
|---|---|---|---|
| `PORT` | Número | Puerto de escucha | `3001` |
| `SRI_AMBIENTE` | Enum (`1` o `2`) | `1` = Pruebas (Celcer) \| `2` = Producción (Cel) | `2` |
| `SRI_REQUIRE_DB` | Booleano | Fail-fast fiscal (debe ser `true` en producción) | `true` |
| `SRI_RUC_EMISOR` | String (13) | RUC de la farmacia | `1790016919001` |
| `SRI_P12_BASE64` | String (Base64) | Certificado digital codificado en Base64 | `MIIKPQIBAzCCCgcGCSqGSIb3...` |
| `SRI_P12_PATH` | Ruta (opcional) | Alternativa: ruta en disco si se monta volumen | `/etc/secrets/firma.p12` |
| `SRI_P12_PASSWORD` | String | Contraseña de la firma electrónica | `TuClaveSegura2026!` |
| `SUPABASE_URL` | URL | URL del proyecto Supabase | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | String | Clave `service_role` de Supabase (acceso backend) | `eyJhbGci...` |
| `JWT_SECRET` | String | Secreto para firma y validación de tokens JWT de sesión (mínimo 32 caracteres) | `mi_secreto_super_seguro_produccion_2026` |
| `POS_API_KEY` | String | Clave para llamadas internas de servicio backend a backend (mínimo 32 caracteres) | `clave_interna_servicio_backend_2026` |
| `FRONTEND_URL` | URL | URL pública del POS (para CORS) | `https://pos.negocios.ualdocorp.com` |
| `SMTP_HOST` | Host (opcional) | Servidor SMTP para envío de facturas | `smtp.gmail.com` |
| `SMTP_PORT` | Número | Puerto SMTP | `587` |
| `SMTP_USER` | String | Usuario o correo emisor | `facturacion@farmacia.com` |
| `SMTP_PASS` | String | Clave de aplicación SMTP | `xxxx xxxx xxxx xxxx` |
| `SMTP_FROM` | String | Correo visible de origen | `facturacion@farmacia.com` |
| `SRI_QUEUE_INTERVAL_SEC` | Número | Frecuencia de chequeo del worker | `5` |

---

## 3. Despliegue Paso a Paso

### Opción A: Despliegue en Render (Recomendado)

1. Conecte su repositorio en [Render Dashboard](https://dashboard.render.com).
2. Cree un nuevo **Web Service**:
   - **Environment:** `Docker`
   - **Dockerfile Path:** `./Dockerfile`
   - **Docker Context:** `.`
   - **Plan:** `Starter` ($7/mes para mantener el worker 24/7 sin sleep)
   - **Health Check Path:** `/api/health`
3. En la sección **Environment Variables**, agregue cada variable descrita en la tabla anterior.
4. En **Secret Files** (opcional si prefiere archivo en vez de Base64):
   - Puede cargar directamente el archivo `firma.p12` como `/etc/secrets/firma.p12` y definir `SRI_P12_PATH=/etc/secrets/firma.p12`.
5. Haga clic en **Create Web Service**.
6. Render compilará la imagen Docker multi-etapa y desplegará el backend con URL tipo: `https://pharmastock-sri-backend.onrender.com`.

---

### Opción B: Despliegue en Railway

1. Cree un proyecto en [Railway](https://railway.app).
2. Seleccione **Deploy from GitHub repo**.
3. Railway detectará automáticamente el archivo `railway.json` y el `Dockerfile`.
4. En la pestaña **Variables**, cargue las variables de entorno.
5. Railway generará un dominio público HTTPS (ej. `https://sri-backend-production.up.railway.app`).

---

### Opción C: Despliegue en Fly.io

1. Instale la CLI de Fly (`flyctl`).
2. Autentíquese: `fly auth login`.
3. Lance la aplicación usando la configuración preconfigurada en `fly.toml`:
   ```bash
   fly launch --no-deploy
   ```
4. Configure los secretos:
   ```bash
   fly secrets set SRI_AMBIENTE=2 SRI_REQUIRE_DB=true SRI_RUC_EMISOR=1790016919001 SRI_P12_PASSWORD=tu_clave SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... POS_API_KEY=... SRI_P12_BASE64="MI..."
   ```
5. Despliegue:
   ```bash
   fly deploy
   ```

---

### Opción D: Despliegue en VPS propio (Docker Compose)

1. En el servidor VPS (Ubuntu/Debian), clone el repositorio.
2. Cree una carpeta `certs/` y coloque su certificado `firma.p12`.
3. Cree un archivo `.env` basado en `.env.example`:
   ```bash
   cp apps/sri-backend/.env.example .env
   nano .env
   ```
4. Inicie el contenedor con reinicio automático:
   ```bash
   docker compose up -d --build
   ```
5. Verifique el estado:
   ```bash
   docker compose logs -f sri-backend
   ```

---

### Opción E: Despliegue en Hetzner con Coolify (Recomendado para el ecosistema Ualdo)

1. **Crear recurso en Coolify:**
   - En el dashboard de Coolify (Hetzner), diríjase a su proyecto / ambiente.
   - Haga clic en **+ New Resource** y luego **Public/Private Repository** (GitHub o GitLab).
   - Indique la URL del repositorio y la rama (ej. `main` o `fix/sri-invoicing-hardening`).
2. **Configuración de Build:**
   - **Build Pack:** `Dockerfile`
   - **Base Directory:** `/`
   - **Dockerfile Path:** `/Dockerfile`
   - **Exposed Port:** `3001`
3. **Dominio y Certificados SSL/TLS:**
   - En **Domains**, configure el subdominio con HTTPS:
     `https://api-sri.tu-dominio.com` (Traefik gestiona Let's Encrypt automáticamente).
4. **Health Check:**
   - **Healthcheck Path:** `/api/health`
   - **Interval:** `30`
   - **Timeout:** `5`
   - **Start Period:** `10`
5. **Variables de Entorno y Secretos en Coolify:**
   Cargue las siguientes variables en la pestaña **Environment Variables**:
   ```env
   PORT=3001
   SRI_AMBIENTE=1
   SRI_REQUIRE_DB=true
   SRI_RUC_EMISOR=1790016919001
   SRI_P12_BASE64=<su_certificado_p12_en_base64>
   SRI_P12_PASSWORD=<clave_del_certificado>
   SUPABASE_URL=https://<su-proyecto>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
   POS_API_KEY=<su_clave_api_pos>
   FRONTEND_URL=https://<su-pos-en-netlify-o-coolify>
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=<correo_emisor>
   SMTP_PASS=<clave_aplicacion_smtp>
   SMTP_FROM=<correo_emisor>
   SRI_QUEUE_INTERVAL_SEC=5
   ```
6. **Despliegue y Webhooks:**
   - Haga clic en **Deploy**.
   - Active **Auto Deploy** para que cada `git push` a la rama despliegue la nueva versión con cero caída (zero-downtime rolling update).

---

## 4. Configuración en Netlify (Frontend POS)

Una vez que el backend esté en línea y accesible vía HTTPS:

1. Ingrese al panel de control de su sitio en [Netlify](https://app.netlify.com).
2. Diríjase a: **Site configuration** y luego **Environment variables**.
3. Configure:
   - `VITE_BACKEND_URL`: URL del backend terminado en `/api` (ej. `https://pharmastock-sri-backend.onrender.com/api`).
   - `VITE_POS_API_KEY`: El mismo valor de `POS_API_KEY` configurado en el backend.
4. Vuelva a desplegar el frontend (**Trigger deploy** y luego **Deploy site**).

---

## 5. Verificación de Funcionamiento en Producción

### 5.1 Verificar Probe de Salud
Abra en el navegador o ejecute:
```bash
curl https://su-backend.com/api/health
```
Respuesta esperada:
```json
{
  "status": "ok",
  "service": "pharmastock-sri-backend",
  "ambiente": "2 (PRODUCCION)",
  "timestamp": "2026-09-28T18:30:00.000Z"
}
```

### 5.2 Verificar Worker de Cola 24/7
En los logs de la plataforma de hosting, verifique la presencia de:
```
[Nest] LOG [SriQueueWorker] Worker de cola SRI iniciado (intervalo: 5s)
[Nest] LOG [SRI-Backend] Servidor de Facturación SRI corriendo en http://localhost:3001/api
```

### 5.3 Smoke Test desde el POS
1. Realice una venta de prueba desde el POS en Netlify.
2. Verifique que la factura sea recibida y autorizada.
3. Si el cliente tiene correo registrado, verifique que reciba el XML firmado y el RIDE en PDF.
4. Consulte la factura en [SRI en Línea](https://srienlinea.sri.gob.ec).
