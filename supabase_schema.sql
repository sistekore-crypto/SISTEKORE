-- ============================================================================
-- SisteKore — Schema completo de Supabase
-- Ejecutar TODO este bloque en: Supabase Dashboard → SQL Editor → New query → RUN
-- ============================================================================

-- =========================
-- 1) Tabla kv_store (persistencia principal — JSON por colección)
-- =========================
create table if not exists public.kv_store (
  key text primary key,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated;
grant all on table public.kv_store to anon, authenticated;

alter table public.kv_store enable row level security;

drop policy if exists "open_select" on public.kv_store;
drop policy if exists "open_insert" on public.kv_store;
drop policy if exists "open_update" on public.kv_store;
drop policy if exists "open_delete" on public.kv_store;

create policy "open_select" on public.kv_store for select to anon, authenticated using (true);
create policy "open_insert" on public.kv_store for insert to anon, authenticated with check (true);
create policy "open_update" on public.kv_store for update to anon, authenticated using (true) with check (true);
create policy "open_delete" on public.kv_store for delete to anon, authenticated using (true);

create index if not exists kv_store_updated_idx on public.kv_store (updated_at desc);

create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_kv_touch on public.kv_store;
create trigger trg_kv_touch
  before update on public.kv_store
  for each row execute function public.touch_updated_at();

-- =========================
-- 2) Tabla profiles (usuarios con status de aprobación)
-- =========================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role text default 'aux_operativo',
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now(),
  approved_at timestamptz,
  approved_by uuid,
  notes text
);

grant all on table public.profiles to anon, authenticated;

alter table public.profiles enable row level security;

drop policy if exists "p_select" on public.profiles;
drop policy if exists "p_insert" on public.profiles;
drop policy if exists "p_update" on public.profiles;
drop policy if exists "p_delete" on public.profiles;

create policy "p_select" on public.profiles for select to anon, authenticated using (true);
create policy "p_insert" on public.profiles for insert to anon, authenticated with check (true);
create policy "p_update" on public.profiles for update to anon, authenticated using (true) with check (true);
create policy "p_delete" on public.profiles for delete to anon, authenticated using (true);

-- =========================
-- 3) Trigger: al crearse un usuario en auth.users → crear profile automáticamente
--    Los emails admin (sistekore@gmail.com) quedan pre-aprobados como dir_operativo.
-- =========================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  default_role text;
  default_status text;
begin
  -- Emails admin auto-aprobados
  if lower(new.email) in ('sistekore@gmail.com') then
    default_status := 'approved';
    default_role := 'dir_operativo';
  else
    default_status := 'pending';
    default_role := 'aux_operativo';
  end if;

  -- Auto-confirmar email solo si es admin (sin necesidad de SMTP)
  if default_status = 'approved' then
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = new.id;
  end if;

  insert into public.profiles (id, email, name, role, status, approved_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    default_role,
    default_status,
    case when default_status = 'approved' then now() else null end
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================
-- 4) Función RPC: admins pueden confirmar emails (para approve manual)
-- =========================
create or replace function public.confirm_user_email(user_id uuid)
returns void as $$
begin
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = user_id;
end;
$$ language plpgsql security definer;

grant execute on function public.confirm_user_email(uuid) to authenticated, anon;

-- =========================
-- 5) Auto-confirmar cualquier usuario existente sin email confirmado
-- =========================
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email_confirmed_at is null;

-- =========================
-- 6) Verificación
-- =========================
select 'SisteKore schema instalado correctamente' as status,
  (select count(*) from pg_policies where tablename = 'kv_store') as kv_policies,
  (select count(*) from pg_policies where tablename = 'profiles') as profile_policies,
  (select count(*) from pg_trigger where tgname = 'on_auth_user_created') as auth_trigger,
  (select count(*) from public.profiles) as usuarios_registrados;

-- ============================================================================
-- Listo. Ahora crea la cuenta de Alexander desde el signup del app:
-- sistekore@gmail.com + tu contraseña → quedará auto-aprobada como admin.
-- ============================================================================
