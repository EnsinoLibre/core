-- Allow deploying worksheets directly to a public link (no class), and add
-- an optional/required password gate on live deployments.
--
-- Class deploys: class_id set, password required.
-- Public deploys: class_id null, password optional.

alter table public.aulas
  alter column class_id drop not null,
  add column password_hash text;

-- get_aula: also surface the class roster (for a name dropdown when the
-- deployment is tied to a class) and whether a password is required —
-- never the hash itself.
create or replace function public.get_aula(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_aula public.aulas; v_ws jsonb; v_class text; v_roster jsonb;
begin
  select * into v_aula from public.aulas where upper(code) = upper(btrim(p_code)) limit 1;
  if v_aula.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if v_aula.status <> 'live' then return jsonb_build_object('error', 'closed'); end if;
  select name into v_class from public.classrooms where id = v_aula.class_id;
  if v_aula.class_id is not null then
    select coalesce(jsonb_agg(s.name order by s.name), '[]'::jsonb)
      into v_roster from public.students s where s.class_id = v_aula.class_id;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'title', w.title, 'subject', w.subject, 'doc', w.doc) order by aw.position), '[]'::jsonb)
    into v_ws from public.aula_worksheets aw join public.worksheets w on w.id = aw.worksheet_id where aw.aula_id = v_aula.id;
  return jsonb_build_object(
    'id', v_aula.id, 'title', v_aula.title, 'code', v_aula.code, 'status', v_aula.status,
    'class', v_class, 'roster', v_roster, 'has_password', v_aula.password_hash is not null,
    'worksheets', v_ws
  );
end; $function$;

-- join_aula: verify the password (if set) and, for class deployments,
-- require the chosen name to match a roster student.
create or replace function public.join_aula(p_code text, p_name text, p_password text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_aula public.aulas; v_enr public.enrollments; v_data jsonb;
begin
  if btrim(coalesce(p_name,'')) = '' then return jsonb_build_object('error', 'name_required'); end if;
  select * into v_aula from public.aulas where upper(code) = upper(btrim(p_code)) limit 1;
  if v_aula.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if v_aula.status <> 'live' then return jsonb_build_object('error', 'closed'); end if;

  if v_aula.password_hash is not null then
    if btrim(coalesce(p_password,'')) = '' then return jsonb_build_object('error', 'password_required'); end if;
    if encode(extensions.digest(p_password::bytea, 'sha256'), 'hex') <> v_aula.password_hash then
      return jsonb_build_object('error', 'bad_password');
    end if;
  end if;

  if v_aula.class_id is not null then
    if not exists (select 1 from public.students s where s.class_id = v_aula.class_id and lower(btrim(s.name)) = lower(btrim(p_name))) then
      return jsonb_build_object('error', 'not_on_roster');
    end if;
  end if;

  insert into public.enrollments (aula_id, name) values (v_aula.id, btrim(p_name))
    on conflict (aula_id, name_key) do update set name = excluded.name
    returning * into v_enr;
  v_data := public.get_aula(p_code);
  return v_data || jsonb_build_object('enrollment_id', v_enr.id, 'student_name', v_enr.name);
end; $function$;
