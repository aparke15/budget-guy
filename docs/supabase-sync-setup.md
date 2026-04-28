# Supabase sync setup

Phase 1 keeps the app local-first. Local storage stays primary, auth is optional, and cloud sync only stores the latest persisted snapshot as a single blob per signed-in user.

## Required env vars

- `vite_supabase_url`
- `vite_supabase_anon_key`

The Vite config also accepts the conventional uppercase variants as a fallback:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

If these env vars are missing, the app still runs locally and the settings sync section stays disabled with a clear message.

## Recommended table + RLS setup

```sql
create table if not exists public.user_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null,
  snapshot jsonb not null,
  updated_at timestamptz not null default now(),
  device_id text,
  snapshot_hash text not null
);

alter table public.user_snapshots enable row level security;

create policy "users can read own snapshot"
on public.user_snapshots
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert own snapshot"
on public.user_snapshots
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update own snapshot"
on public.user_snapshots
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## Current behavior

- Magic-link auth is optional and only used from settings.
- Remote reads go through the same migration-aware persisted-state parse path used by local storage and backup import.
- Push uploads a single latest-version snapshot row for the signed-in user.
- Pull replaces local state through the existing `replacePersistedState` path after confirmation.
- Sync metadata is stored locally outside the domain schema: device id, snapshot hash, snapshot timestamp, and last synced hash metadata.