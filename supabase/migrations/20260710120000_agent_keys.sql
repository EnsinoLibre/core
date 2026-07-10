-- Agent keys: personal bearer tokens teachers hand to their AI (MCP clients).
-- Only the SHA-256 hash is stored; the raw key is shown once in the app.
-- The `mcp` edge function maps an incoming key back to its teacher and writes
-- into the workspace with that teacher_id (service role, RLS-equivalent scoping).

create table if not exists public.agent_keys (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  key_hash text not null unique,
  label text not null default 'My agent',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.agent_keys enable row level security;

create policy "agent_keys are teacher-scoped"
  on public.agent_keys for all to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create index if not exists agent_keys_teacher_idx on public.agent_keys (teacher_id);
