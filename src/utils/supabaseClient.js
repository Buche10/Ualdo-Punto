import { createClient } from '@supabase/supabase-js';

// Lee las credenciales desde las variables de entorno de Vite (.env)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// La nube solo se activa si AMBAS credenciales están presentes y no son los
// valores de ejemplo. Si falta alguna, la app cae a localStorage automáticamente.
const isPlaceholder = (value) =>
  !value || value.includes('TU-PROYECTO') || value.includes('TU_CLAVE');

export const isCloudEnabled = !isPlaceholder(supabaseUrl) && !isPlaceholder(supabaseAnonKey);

// Cliente único (o null si la nube no está configurada)
export const supabase = isCloudEnabled
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: { params: { eventsPerSecond: 5 } }
    })
  : null;
