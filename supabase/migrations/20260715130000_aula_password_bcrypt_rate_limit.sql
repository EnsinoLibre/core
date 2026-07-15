-- join_aula password hardening (EnsinoLibre/core#46):
--   1. bcrypt (pgcrypto crypt/gen_salt) instead of unsalted sha256, with a
--      one-time opportunistic upgrade path for existing sha256 hashes.
--   2. Per-aula rate limiting / lockout on repeated wrong guesses, enforced
--      inside join_aula itself since it's called directly via PostgREST
--      RPC by anon — there is no app-server layer to throttle at.
--   3. Password SET moves server-side (set_aula_password RPC) so the
--      plaintext is hashed with bcrypt in Postgres; the client no longer
--      computes and uploads a hash itself.

alter table public.aulas
  add column if not exists failed_attempts int not null default 0,
  add column if not exists locked_until timestamptz;

-- Teacher-owned: hash and set (or clear, with a null/blank password) an
-- aula's password. SECURITY DEFINER so it can write despite RLS, but scoped
-- to the caller's own aulas via auth.uid().
create or replace function public.set_aula_password(p_aula_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.aulas where id = p_aula_id and teacher_id = auth.uid()) then
    raise exception 'not_found_or_not_owner';
  end if;
  update public.aulas
    set password_hash = case when p_password is null or btrim(p_password) = '' then null
                              else extensions.crypt(p_password, extensions.gen_salt('bf')) end,
        failed_attempts = 0,
        locked_until = null
    where id = p_aula_id;
end;
$function$;

revoke all on function public.set_aula_password(uuid, text) from public, anon;
grant execute on function public.set_aula_password(uuid, text) to authenticated;

-- join_aula: bcrypt-aware check (with legacy-sha256 read + upgrade), lockout
-- after repeated wrong guesses, self-healing once a lockout has expired.
create or replace function public.join_aula(p_code text, p_name text, p_password text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_aula public.aulas; v_enr public.enrollments; v_data jsonb;
  v_max_attempts constant int := 5;
  v_lock_minutes constant int := 15;
  v_ok boolean;
begin
  if btrim(coalesce(p_name,'')) = '' then return jsonb_build_object('error', 'name_required'); end if;
  select * into v_aula from public.aulas where upper(code) = upper(btrim(p_code)) limit 1;
  if v_aula.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if v_aula.status <> 'live' then return jsonb_build_object('error', 'closed'); end if;

  -- A lockout that has already expired self-heals on the next attempt
  -- instead of staying "half locked" with a stale attempt count.
  if v_aula.locked_until is not null and v_aula.locked_until <= now() then
    update public.aulas set failed_attempts = 0, locked_until = null where id = v_aula.id;
    v_aula.failed_attempts := 0; v_aula.locked_until := null;
  end if;

  if v_aula.password_hash is not null then
    if v_aula.locked_until is not null and v_aula.locked_until > now() then
      return jsonb_build_object('error', 'locked', 'locked_until', v_aula.locked_until);
    end if;
    if btrim(coalesce(p_password,'')) = '' then return jsonb_build_object('error', 'password_required'); end if;

    -- bcrypt hashes are '$2...'; anything else is a legacy sha256 hex digest.
    if v_aula.password_hash like '$2%' then
      v_ok := extensions.crypt(p_password, v_aula.password_hash) = v_aula.password_hash;
    else
      v_ok := encode(extensions.digest(p_password::bytea, 'sha256'), 'hex') = v_aula.password_hash;
      if v_ok then
        update public.aulas set password_hash = extensions.crypt(p_password, extensions.gen_salt('bf')) where id = v_aula.id;
      end if;
    end if;

    if not v_ok then
      if v_aula.failed_attempts + 1 >= v_max_attempts then
        update public.aulas set failed_attempts = failed_attempts + 1, locked_until = now() + (v_lock_minutes || ' minutes')::interval where id = v_aula.id;
        return jsonb_build_object('error', 'locked', 'locked_until', now() + (v_lock_minutes || ' minutes')::interval);
      end if;
      update public.aulas set failed_attempts = failed_attempts + 1 where id = v_aula.id;
      return jsonb_build_object('error', 'bad_password');
    end if;

    update public.aulas set failed_attempts = 0, locked_until = null where id = v_aula.id;
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
end;
$function$;
