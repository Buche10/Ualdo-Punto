# PharmaStock Express — Inventario de Farmacia

App de **toma de inventario y auditoría de stock** para farmacia, con escáner de código
de barras por cámara del celular, control de lotes/vencimientos y **sincronización en la
nube en tiempo real** (opcional) vía Supabase.

Stack: React 19 + Vite + Tailwind CSS 4. Datos en `localStorage` por defecto, o en
Supabase cuando se configuran las credenciales.

## Desarrollo

```bash
npm install
npm run dev      # servidor local (accesible desde celulares en la misma red WiFi)
npm run build    # genera dist/ para producción
npm run preview  # sirve dist/ localmente
```

## Sincronización en la nube (Supabase) — opcional

Sin configurar nada, la app funciona con `localStorage` (datos por dispositivo). Para que
**varios celulares/PC compartan el mismo inventario en tiempo real**, conecta Supabase:

### 1. Crea el proyecto
1. Entra a [supabase.com](https://supabase.com) y crea una cuenta (gratis).
2. **New project** → ponle nombre y una contraseña de base de datos → **Create**.
3. Espera ~1 minuto a que se aprovisione.

### 2. Crea las tablas
1. En el menú lateral: **SQL Editor → New query**.
2. Abre el archivo [`supabase/schema.sql`](supabase/schema.sql) de este repo, copia todo su
   contenido, pégalo y presiona **Run**. Esto crea las tablas, activa el tiempo real y los permisos.

### 3. Conecta la app
1. En Supabase: **Project Settings → API** (o **Data API**).
2. Copia **Project URL** y la clave **anon public**.
3. En la raíz del proyecto, copia `.env.example` como `.env` y pega los valores:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_clave_anon_publica
   ```
4. `npm run build` (o reinicia `npm run dev`).

Cuando esté activo, el indicador del header mostrará **🟢 Nube**. Cualquier conteo,
alta o borrado se replica al instante en todos los dispositivos conectados.

> **Nota de seguridad:** la clave `anon` viaja en el bundle del front (es pública por
> diseño). Con las políticas del `schema.sql`, cualquiera con la URL + esa clave puede
> leer/escribir. Es adecuado para una herramienta interna cuya URL no se difunde. Para
> multiusuario en producción, añade Supabase Auth y restringe las políticas RLS.

## Despliegue (producción)

El escáner de cámara **requiere HTTPS**. La forma más simple:

1. `npm run build`
2. Arrastra la carpeta `dist/` a [app.netlify.com/drop](https://app.netlify.com/drop)
   (o conecta el repo a Netlify/Vercel/Cloudflare Pages; ya hay `netlify.toml`).
3. Abre la URL `https://...` en cada celular y permite el acceso a la cámara.

Si usas Supabase, define las mismas variables `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY` en la configuración de entorno del hosting (en Netlify:
**Site settings → Environment variables**) para que el sitio publicado también sincronice.
