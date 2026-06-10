-- =====================================================
-- Gestion_Pedidos_ICBC — Update v2
-- Soft delete + historial de actividad + rol super_admin
-- =====================================================

-- ─── 1. Soft delete en pedidos ───
alter table public.pedidos
  add column if not exists deleted_at timestamptz default null,
  add column if not exists deleted_by uuid references public.profiles(id);

-- ─── 2. Actualizar constraint de rol ───
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('super_admin','admin','colaborador','viewer'));

-- ─── 3. Tabla de historial de actividad ───
create table if not exists public.actividad (
  id          uuid primary key default gen_random_uuid(),
  pedido_id   uuid references public.pedidos(id) on delete cascade,
  user_id     uuid references public.profiles(id),
  tipo        text not null,
  -- tipos: creacion | cambio_estado | cambio_prioridad | asignacion | eliminacion | restauracion
  detalle     jsonb default '{}',
  created_at  timestamptz default now()
);

-- ─── 4. RLS para actividad ───
alter table public.actividad enable row level security;

create policy "actividad: todos pueden ver"
  on public.actividad for select
  using (auth.role() = 'authenticated');

create policy "actividad: todos pueden insertar"
  on public.actividad for insert
  with check (auth.role() = 'authenticated');

-- ─── 5. Actualizar RLS de pedidos para soft delete ───
-- Los pedidos eliminados solo los ve super_admin
drop policy if exists "pedidos: ver todos" on public.pedidos;

create policy "pedidos: ver activos"
  on public.pedidos for select
  using (
    auth.role() = 'authenticated'
    and (
      deleted_at is null
      or public.my_role() = 'super_admin'
    )
  );

-- Solo super_admin puede hacer hard delete (aunque no lo vamos a usar)
drop policy if exists "pedidos: solo admin elimina" on public.pedidos;

create policy "pedidos: solo super_admin elimina"
  on public.pedidos for delete
  using (public.my_role() = 'super_admin');

-- Admin y super_admin pueden actualizar (incluye soft delete)
drop policy if exists "pedidos: admin y colaborador actualizan" on public.pedidos;

create policy "pedidos: admin y super_admin actualizan"
  on public.pedidos for update
  using (public.my_role() in ('super_admin','admin','colaborador'));

-- ─── 6. Actualizar my_role() para incluir super_admin ───
create or replace function public.my_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ─── 7. Asignar super_admin al primer usuario ───
-- Cambiá el email por el tuyo
-- update public.profiles set role = 'super_admin' where email = 'tu@email.com';

-- ─── 8. Realtime para actividad ───
alter publication supabase_realtime add table public.actividad;
