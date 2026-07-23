---
title: The tenancy seam
description: How the OSS single-tenant schema reserves a non-breaking seam for the commercial multi-tenant Organisation layer.
tags: ensinolibre, architecture, backend
status: stable
---

# The tenancy seam

> [!note] One sentence
> The open-source schema is single-tenant (one teacher owns their rows). The
> **tenancy seam** is the small set of changes that lets the paid
> **Organisation** layer add multi-tenant, org-wide sharing *later* without
> rewriting a single RLS policy on the content tables — because those policies
> already delegate their authorization decision to two replaceable functions.

Migration: [`supabase/migrations/20260723120000_tenancy_seam.sql`](../../supabase/migrations/20260723120000_tenancy_seam.sql).
Product context: [VERSIONING.md](../../VERSIONING.md).

## Why this exists

EnsinoLibre's open-core line is: the worksheet builder and the **single-tenant**
teacher platform are MIT and self-hostable; the **Organisation** product —
per-seat billing for a school, with a *shared* org-wide knowledge base across
many teachers — is the commercial layer.

Every content table in the OSS schema is scoped `teacher_id = auth.uid()`. That
means "owner" and "the only person who can see this" are the same concept. An
organisation is a namespace that must sit *above* the teacher. If we freeze a
v1.0 schema with the owner check hardcoded into every policy, retrofitting
multi-tenancy later means rewriting every RLS policy, the MCP edge function's
scoping, and the store's write paths — across live data.

The seam removes that future cost for near-zero present cost. It ships in OSS,
changes nothing for OSS users, and is the *only* schema concession the paid
layer needs reserved up front.

## The mechanism

### 1. Authorization is delegated, not inlined

Before, each content table carried one `ALL` policy:

```sql
-- before
create policy "own rows" on public.resources for all
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());
```

After the seam, the decision lives in two functions and the policy calls them:

```sql
-- after (OSS bodies shown; behaviour identical)
create function public.el_can_read (row_teacher_id uuid, row_org_id uuid) ... as
  $$ select row_teacher_id = auth.uid(); $$;
create function public.el_can_write(row_teacher_id uuid, row_org_id uuid) ... as
  $$ select row_teacher_id = auth.uid(); $$;

create policy "tenant access" on public.resources for all
  using      (public.el_can_read (teacher_id, org_id))
  with check (public.el_can_write(teacher_id, org_id));
```

`USING` governs read visibility (SELECT, and the pre-image of UPDATE/DELETE);
`WITH CHECK` governs write authorization (INSERT, and the post-image of UPDATE).
Splitting read from write now lets the paid layer grant a "viewer" seat
(`el_can_read` true, `el_can_write` false) without touching policies.

### 2. `org_id` is reserved but inert

Every shared-content table gets a nullable `org_id uuid` (no FK yet — the
`organizations` table is in the paid layer). In OSS it is always `NULL`, so the
`row_org_id` argument is dead weight and the helpers ignore it. Partial indexes
(`where org_id is not null`) are empty and free until the paid layer populates
them.

### Tables covered

| Table | Scoping | Seam |
|---|---|---|
| `classrooms`, `students`, `student_notes`, `worksheets`, `resources`, `aulas` | direct `teacher_id` | `org_id` column + `tenant access` policy via helpers |
| `aula_worksheets`, `enrollments`, `progress` | indirect, via owning aula | policy's `EXISTS(... aulas ...)` now calls the helpers on the aula's `teacher_id`/`org_id` |

Because the child tables delegate through the *aula's* helper call, opening an
aula to org members later automatically carries its worksheets, enrollments and
progress — no extra migration.

### Out of scope (deliberately)

`profiles`, `agent_keys`, `agent_activity` get **no** `org_id`. They are
identity, credentials and audit — not shared KB content. The Organisation layer
governs them on its own terms (e.g. an org admin seeing org-wide agent activity
is a *new* policy, not a change to these). Reserving `org_id` here now would be
speculative.

The student path is untouched: `get_aula` / `join_aula` / `save_progress` and
the other public RPCs are `SECURITY DEFINER` and bypass RLS entirely.

## Why it is non-breaking

- OSS `el_can_read`/`el_can_write` are exactly `teacher_id = auth.uid()`.
- `org_id` is nullable and unset, so no existing row changes.
- Role targeting (`public`) is preserved; anon's `auth.uid()` is null, so anon
  is denied exactly as before.
- Verified post-apply by role simulation: each teacher sees precisely their own
  row counts; anon sees zero. See the migration's companion verification in the
  deploy notes.

## What the paid follow-up migration does

Lives in the **commercial** layer (not this repo). Sketch:

```sql
-- 1. New tenant tables
create table org.organizations (id uuid primary key default gen_random_uuid(),
  name text not null, created_at timestamptz default now(), ...);
create table org.org_members (org_id uuid references org.organizations(id),
  user_id uuid references auth.users(id),
  role text not null check (role in ('admin','teacher','viewer')),
  primary key (org_id, user_id));

-- 2. Swap the seam function bodies — NO policy changes
create or replace function public.el_can_read(row_teacher_id uuid, row_org_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select row_teacher_id = auth.uid()
      or (row_org_id is not null and exists (
            select 1 from org.org_members m
            where m.org_id = row_org_id and m.user_id = auth.uid()));
$$;

create or replace function public.el_can_write(row_teacher_id uuid, row_org_id uuid)
returns boolean language sql stable security invoker set search_path = public as $$
  select row_teacher_id = auth.uid()
      or (row_org_id is not null and exists (
            select 1 from org.org_members m
            where m.org_id = row_org_id and m.user_id = auth.uid()
              and m.role in ('admin','teacher')));  -- viewers are read-only
$$;

-- 3. Add the FK + backfill org_id for rows owned by org members, and set
--    org_id on future writes (app-side or a before-insert trigger).
```

That is the entire content-table change for multi-tenancy: **three steps, zero
policy rewrites.** Everything else the Organisation product needs (seat billing,
admin console, SSO, invites) is new surface that sits beside this, not on top of
a schema rewrite.

## Rollback

The seam is reversible. To undo (restores the original "own rows" policies):

```sql
begin;
do $$ declare tbl text; begin
  foreach tbl in array array['classrooms','students','student_notes','worksheets','resources','aulas']
  loop
    execute format('drop policy if exists "tenant access" on public.%I', tbl);
    execute format('create policy "own rows" on public.%I for all '
      || 'using (teacher_id = auth.uid()) with check (teacher_id = auth.uid())', tbl);
  end loop;
end $$;
-- recreate the original child policies (aula_worksheets/enrollments/progress)
-- from migration 20260711050000_public_aula_deploy.sql, then:
drop policy if exists "tenant aula worksheets" on public.aula_worksheets;
drop policy if exists "tenant enrollments" on public.enrollments;
drop policy if exists "tenant progress" on public.progress;
-- columns can stay (harmless) or be dropped:
-- alter table public.resources drop column org_id;  -- etc.
drop function if exists public.el_can_read(uuid, uuid);
drop function if exists public.el_can_write(uuid, uuid);
commit;
```

## Performance note

`el_can_read`/`el_can_write` are `stable` pure-SQL functions; Postgres can often
inline them, and at EnsinoLibre's scale (hundreds–thousands of rows per teacher)
the owner-branch is index-friendly (`teacher_id`). If org membership ever grows
hot, the membership `EXISTS` is a two-column PK lookup on `org_members`. Revisit
only if `EXPLAIN` on a large org shows the helper dominating.
