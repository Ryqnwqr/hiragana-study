-- Cloud progress storage for signed-in users.
--
-- This is the table the app's sync pipeline reads/writes:
--   src/lib/cloud-progress.ts  -> .from("user_progress").select("payload")/.upsert(...)
--   src/app/api/auth/sync/route.ts
--
-- Columns mirror saveCloudProgress(): one row per user, compact JSON payload,
-- and an updated_at touched on every upsert. RLS restricts every row to its
-- owner so the browser anon key is safe to use for direct access.

create table if not exists public.user_progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  payload    jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;

-- auth.uid() = user_id gates every operation to the row's owner.
-- Separate policies per command keep INSERT (WITH CHECK) and UPDATE
-- (USING + WITH CHECK) explicit, which an upsert exercises both of.

drop policy if exists "user_progress_select_own" on public.user_progress;
create policy "user_progress_select_own"
  on public.user_progress
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_progress_insert_own" on public.user_progress;
create policy "user_progress_insert_own"
  on public.user_progress
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_progress_update_own" on public.user_progress;
create policy "user_progress_update_own"
  on public.user_progress
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
