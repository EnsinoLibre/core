-- Live activity log for MCP-connected agents: one row per tool call, used by
-- the Knowledge graph to render a pulsing "Agent" node and light up whatever
-- workspace node the agent is currently reading/writing. Written only by the
-- `mcp` edge function (service role); teachers can read their own rows.
create table public.agent_activity (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  agent_key_id uuid references public.agent_keys(id) on delete set null,
  agent_label text not null default 'Agent',
  tool text not null,
  status text not null default 'done' check (status in ('start','done','error')),
  target_node_id text,
  summary text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index agent_activity_teacher_recent_idx on public.agent_activity (teacher_id, created_at desc);

alter table public.agent_activity enable row level security;

create policy "own agent activity" on public.agent_activity
  for select using (teacher_id = auth.uid());
