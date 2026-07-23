-- Tenancy seam ------------------------------------------------------------
--
-- Purpose: reserve the multi-tenant seam in the OSS schema WITHOUT changing
-- any current behaviour, so the commercial "Organisation" layer (per-seat,
-- org-wide shared knowledge base) can be layered on later with ZERO policy
-- churn on these tables.
--
-- How it works:
--   * Every teacher-scoped content table gets a nullable `org_id` column.
--     In the OSS build it is ALWAYS NULL.
--   * The historical `teacher_id = auth.uid()` check is moved OUT of each RLS
--     policy and INTO two replaceable authorization functions,
--     `el_can_read` / `el_can_write`. Policies now DELEGATE to those.
--   * In OSS both functions reduce to owner-only, so access is byte-for-byte
--     identical to before this migration.
--   * The Organisation layer ships a follow-up migration that (a) creates
--     `organizations` + `org_members`, (b) `CREATE OR REPLACE`s the two
--     function bodies to add an org-membership branch, and (c) populates
--     `org_id`. No policy on the content tables is ever rewritten again.
--
-- See docs/architecture/tenancy-seam.md for the full rationale, the rollback
-- script, and the shape of the paid follow-up migration.
--
-- This migration is behaviour-preserving and reversible. It is OSS (MIT).

begin;

-- 1. Authorization helpers -------------------------------------------------
-- OSS bodies: owner-only. The Organisation layer replaces these bodies via
-- CREATE OR REPLACE (never DROP — the policies below depend on them).
-- SECURITY INVOKER so auth.uid() resolves to the *querying* user's JWT.

create or replace function public.el_can_read(row_teacher_id uuid, row_org_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select row_teacher_id = auth.uid();
$$;

create or replace function public.el_can_write(row_teacher_id uuid, row_org_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select row_teacher_id = auth.uid();
$$;

comment on function public.el_can_read(uuid, uuid) is
  'Tenancy seam (read visibility). OSS: owner-only (row_teacher_id = auth.uid()). '
  'The Organisation layer CREATE OR REPLACEs this body to add an org-membership '
  'branch. Never DROP — content-table RLS policies delegate to it. See '
  'docs/architecture/tenancy-seam.md.';

comment on function public.el_can_write(uuid, uuid) is
  'Tenancy seam (write authorization). OSS: owner-only. The Organisation layer '
  'CREATE OR REPLACEs this body to add an org-member-with-write-role branch. '
  'Never DROP. See docs/architecture/tenancy-seam.md.';

-- 2. Reserve the org_id column on every shared-content table ----------------
-- Nullable, no FK yet (the `organizations` table lives in the paid layer).
-- Partial indexes cost nothing while every row has org_id IS NULL.

alter table public.classrooms    add column if not exists org_id uuid;
alter table public.students       add column if not exists org_id uuid;
alter table public.student_notes  add column if not exists org_id uuid;
alter table public.worksheets     add column if not exists org_id uuid;
alter table public.resources      add column if not exists org_id uuid;
alter table public.aulas          add column if not exists org_id uuid;

create index if not exists classrooms_org_id_idx   on public.classrooms(org_id)   where org_id is not null;
create index if not exists students_org_id_idx      on public.students(org_id)      where org_id is not null;
create index if not exists student_notes_org_id_idx on public.student_notes(org_id) where org_id is not null;
create index if not exists worksheets_org_id_idx    on public.worksheets(org_id)    where org_id is not null;
create index if not exists resources_org_id_idx     on public.resources(org_id)     where org_id is not null;
create index if not exists aulas_org_id_idx         on public.aulas(org_id)         where org_id is not null;

-- 3. Route the directly-scoped content policies through the helpers ---------
-- Each of these tables previously had ONE `ALL` policy named "own rows" with
-- USING = WITH CHECK = (teacher_id = auth.uid()). We replace it with an
-- equivalent policy whose USING delegates to el_can_read and whose WITH CHECK
-- delegates to el_can_write. Role targeting (public) is preserved: anon has a
-- null auth.uid(), so the check is false for anon exactly as before.

do $$
declare tbl text;
begin
  foreach tbl in array array['classrooms','students','student_notes','worksheets','resources','aulas']
  loop
    execute format('drop policy if exists "own rows" on public.%I', tbl);
    execute format(
      'create policy "tenant access" on public.%I for all '
      || 'using (public.el_can_read(teacher_id, org_id)) '
      || 'with check (public.el_can_write(teacher_id, org_id))', tbl);
  end loop;
end $$;

-- 4. Route the aula-derived child policies through the helpers --------------
-- aula_worksheets / enrollments / progress are scoped indirectly via the
-- owning aula. Delegating the EXISTS(...) check to the same helpers means that
-- when the Organisation layer opens an aula to org members, its worksheets,
-- enrollments and progress follow automatically — no further migration.

-- aula_worksheets (was single ALL policy "own aula worksheets")
drop policy if exists "own aula worksheets" on public.aula_worksheets;
create policy "tenant aula worksheets" on public.aula_worksheets for all
  using (exists (
    select 1 from public.aulas a
    where a.id = aula_worksheets.aula_id and public.el_can_read(a.teacher_id, a.org_id)))
  with check (exists (
    select 1 from public.aulas a
    where a.id = aula_worksheets.aula_id and public.el_can_write(a.teacher_id, a.org_id)));

-- enrollments (was "teacher reads enrollments" SELECT + "teacher writes enrollments" ALL)
drop policy if exists "teacher reads enrollments" on public.enrollments;
drop policy if exists "teacher writes enrollments" on public.enrollments;
create policy "tenant enrollments" on public.enrollments for all
  using (exists (
    select 1 from public.aulas a
    where a.id = enrollments.aula_id and public.el_can_read(a.teacher_id, a.org_id)))
  with check (exists (
    select 1 from public.aulas a
    where a.id = enrollments.aula_id and public.el_can_write(a.teacher_id, a.org_id)));

-- progress (was "teacher reads progress" SELECT + "teacher writes progress" ALL)
drop policy if exists "teacher reads progress" on public.progress;
drop policy if exists "teacher writes progress" on public.progress;
create policy "tenant progress" on public.progress for all
  using (exists (
    select 1 from public.aulas a
    where a.id = progress.aula_id and public.el_can_read(a.teacher_id, a.org_id)))
  with check (exists (
    select 1 from public.aulas a
    where a.id = progress.aula_id and public.el_can_write(a.teacher_id, a.org_id)));

-- NOTE: profiles, agent_keys and agent_activity are intentionally NOT given an
-- org_id here. They are identity/credential/audit tables, not shared KB
-- content; the Organisation layer governs them separately (org admins vs. the
-- key-owning teacher). See docs/architecture/tenancy-seam.md §"Out of scope".
--
-- Student-facing SECURITY DEFINER RPCs (get_aula/join_aula/save_progress/…)
-- bypass RLS and are unchanged: the student path is unaffected by this seam.

commit;
