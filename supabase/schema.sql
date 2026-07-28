-- Bei Opa — run this once in the Supabase SQL Editor.
-- One row per user holding their full progress state as jsonb.

create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

create policy "read own state"
  on public.user_state for select
  using (auth.uid() = user_id);

create policy "insert own state"
  on public.user_state for insert
  with check (auth.uid() = user_id);

create policy "update own state"
  on public.user_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Guard: no single user can store more than ~256 KB of state
-- (protects the free-tier database from abuse or runaway bugs).
alter table public.user_state
  add constraint state_size_limit check (pg_column_size(state) < 262144);
