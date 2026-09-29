-- =====================================================================
-- PharmaStock Express — Esquema de sincronización en la nube (Supabase)
-- =====================================================================
-- Cómo usarlo:
--   1. Entra a tu proyecto en https://supabase.com
--   2. Menú lateral: SQL Editor > New query
--   3. Pega TODO este archivo y presiona "Run"
-- Esto crea las tablas, activa el tiempo real y define los permisos.
-- =====================================================================

-- Tabla de productos: el objeto completo se guarda en la columna JSONB `data`
create table if not exists public.products (
  id         text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Tabla de lotes: `product_id` permite el borrado en cascada por producto
create table if not exists public.batches (
  id         text primary key,
  product_id text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists batches_product_id_idx on public.batches (product_id);

-- ---------------------------------------------------------------------
-- Tiempo real: publicar cambios de ambas tablas a los clientes suscritos
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.batches;

-- ---------------------------------------------------------------------
-- Permisos (RLS)
-- ---------------------------------------------------------------------
-- Se habilita RLS y se permite acceso completo con la clave pública `anon`.
-- AVISO: Esto significa que cualquiera con la URL + la clave anón puede leer y
--    escribir. Es aceptable para una herramienta interna cuya URL no se
--    comparte públicamente. Para producción con varios usuarios se recomienda
--    añadir autenticación (Supabase Auth) y restringir estas políticas.
alter table public.products enable row level security;
alter table public.batches  enable row level security;

drop policy if exists "acceso_total_productos" on public.products;
create policy "acceso_total_productos" on public.products
  for all using (true) with check (true);

drop policy if exists "acceso_total_lotes" on public.batches;
create policy "acceso_total_lotes" on public.batches
  for all using (true) with check (true);
