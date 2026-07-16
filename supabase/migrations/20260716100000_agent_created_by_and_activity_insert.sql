-- Agent write trust & review (EnsinoLibre/core#29): track which agent key
-- created a worksheet/resource, so the teacher can see and revert
-- agent-created items from the platform.
alter table public.worksheets
  add column if not exists created_by_agent_key_id uuid references public.agent_keys(id) on delete set null;
alter table public.resources
  add column if not exists created_by_agent_key_id uuid references public.agent_keys(id) on delete set null;

-- The platform (authenticated teacher) previously had no write access to
-- agent_activity at all (only the mcp edge function, via service role,
-- could insert). Reverting an agent-created item from the UI needs to log
-- that action into the same audit trail, so teachers get insert on their
-- own rows only.
create policy "own agent activity insert" on public.agent_activity
  for insert with check (teacher_id = auth.uid());
