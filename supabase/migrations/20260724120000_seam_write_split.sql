-- Tenancy seam refinement: split read vs. write authorization per command.
--
-- The original seam (20260723120000) used a single `ALL` policy per content
-- table: USING el_can_read, WITH CHECK el_can_write. That is correct for
-- SELECT/INSERT/UPDATE, but DELETE only consults USING — so once org sharing is
-- live, ANY org member (including a read-only viewer) could DELETE org-shared
-- content, because el_can_read is true for them. (Confirmed on a viewer.)
--
-- Fix: replace each single ALL policy with per-command policies, so that write
-- operations (INSERT/UPDATE/DELETE) require el_can_write while reads use
-- el_can_read:
--   SELECT  using el_can_read      -- owner or ANY member (incl. viewer)
--   INSERT  check el_can_write     -- owner or admin/teacher member
--   UPDATE  using+check el_can_write
--   DELETE  using el_can_write
--
-- Behaviour is UNCHANGED in OSS: there el_can_read == el_can_write ==
-- (teacher_id = auth.uid()), so every command stays owner-only. The split only
-- matters once an org with non-owner members exists. Still delegates entirely
-- to the seam helpers (no auth.uid() re-inlining), so the §11b guard passes.
--
-- Scope: the six directly teacher-scoped content tables. The aula-derived child
-- tables (aula_worksheets/enrollments/progress) keep their existing policies —
-- aulas are not org-shared yet, so the gap is unreachable there; apply the same
-- split if/when aula sharing lands.

begin;

drop policy if exists "tenant access" on public.classrooms;
create policy "tenant read"   on public.classrooms for select using (public.el_can_read(teacher_id, org_id));
create policy "tenant insert" on public.classrooms for insert with check (public.el_can_write(teacher_id, org_id));
create policy "tenant update" on public.classrooms for update using (public.el_can_write(teacher_id, org_id)) with check (public.el_can_write(teacher_id, org_id));
create policy "tenant delete" on public.classrooms for delete using (public.el_can_write(teacher_id, org_id));

drop policy if exists "tenant access" on public.students;
create policy "tenant read"   on public.students for select using (public.el_can_read(teacher_id, org_id));
create policy "tenant insert" on public.students for insert with check (public.el_can_write(teacher_id, org_id));
create policy "tenant update" on public.students for update using (public.el_can_write(teacher_id, org_id)) with check (public.el_can_write(teacher_id, org_id));
create policy "tenant delete" on public.students for delete using (public.el_can_write(teacher_id, org_id));

drop policy if exists "tenant access" on public.student_notes;
create policy "tenant read"   on public.student_notes for select using (public.el_can_read(teacher_id, org_id));
create policy "tenant insert" on public.student_notes for insert with check (public.el_can_write(teacher_id, org_id));
create policy "tenant update" on public.student_notes for update using (public.el_can_write(teacher_id, org_id)) with check (public.el_can_write(teacher_id, org_id));
create policy "tenant delete" on public.student_notes for delete using (public.el_can_write(teacher_id, org_id));

drop policy if exists "tenant access" on public.worksheets;
create policy "tenant read"   on public.worksheets for select using (public.el_can_read(teacher_id, org_id));
create policy "tenant insert" on public.worksheets for insert with check (public.el_can_write(teacher_id, org_id));
create policy "tenant update" on public.worksheets for update using (public.el_can_write(teacher_id, org_id)) with check (public.el_can_write(teacher_id, org_id));
create policy "tenant delete" on public.worksheets for delete using (public.el_can_write(teacher_id, org_id));

drop policy if exists "tenant access" on public.resources;
create policy "tenant read"   on public.resources for select using (public.el_can_read(teacher_id, org_id));
create policy "tenant insert" on public.resources for insert with check (public.el_can_write(teacher_id, org_id));
create policy "tenant update" on public.resources for update using (public.el_can_write(teacher_id, org_id)) with check (public.el_can_write(teacher_id, org_id));
create policy "tenant delete" on public.resources for delete using (public.el_can_write(teacher_id, org_id));

drop policy if exists "tenant access" on public.aulas;
create policy "tenant read"   on public.aulas for select using (public.el_can_read(teacher_id, org_id));
create policy "tenant insert" on public.aulas for insert with check (public.el_can_write(teacher_id, org_id));
create policy "tenant update" on public.aulas for update using (public.el_can_write(teacher_id, org_id)) with check (public.el_can_write(teacher_id, org_id));
create policy "tenant delete" on public.aulas for delete using (public.el_can_write(teacher_id, org_id));

commit;
