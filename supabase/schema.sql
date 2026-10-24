-- 拾词 · Supabase 云同步表
-- 在 Supabase Dashboard → SQL Editor 中整段执行一次。

create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "select own state" on public.user_state;
create policy "select own state"
  on public.user_state for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "insert own state" on public.user_state;
create policy "insert own state"
  on public.user_state for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "update own state" on public.user_state;
create policy "update own state"
  on public.user_state for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.user_state to authenticated;
