-- Enable Supabase Realtime (Postgres Changes) for the two tables students
-- write to via RPC (join_aula, save_progress) so the teacher's Live monitor
-- can subscribe instead of polling every 4s. RLS stays the enforcement
-- boundary — Realtime honours each table's existing SELECT policies, so a
-- teacher only receives change events for their own aulas' rows.
alter publication supabase_realtime add table public.progress, public.enrollments;
