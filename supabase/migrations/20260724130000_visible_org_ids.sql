-- Tenancy seam (read scope): which org ids' shared content a user may read.
--
-- Mirrors el_can_read/el_can_write: in the open-source core this returns no
-- orgs, so the MCP's resource/worksheet reads stay owner-only (single-tenant
-- behaviour unchanged). The commercial Organisation layer CREATE OR REPLACEs the
-- body to return the org ids the user belongs to — at which point a connected
-- agent starts seeing the shared org knowledge base. Never DROP (the MCP edge
-- function calls it by name).
--
-- Called only by the MCP edge function under the service role, always with an
-- explicit p_user. It is therefore restricted to service_role: a per-user
-- membership lookup must NOT be callable by anon/authenticated with an arbitrary
-- p_user (that would leak who belongs to which org).

create or replace function public.el_visible_org_ids(p_user uuid)
returns uuid[]
language sql
stable
security invoker
set search_path = public
as $$
  select '{}'::uuid[];
$$;

comment on function public.el_visible_org_ids(uuid) is
  'Tenancy seam (read scope). OSS: returns {} (no org sharing). The Organisation '
  'layer CREATE OR REPLACEs this to return p_user''s org ids. service_role-only; '
  'never DROP (the MCP calls it). See docs/architecture/tenancy-seam.md.';

revoke execute on function public.el_visible_org_ids(uuid) from public, anon, authenticated;
grant execute on function public.el_visible_org_ids(uuid) to service_role;
