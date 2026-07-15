-- Internal primitive so the MCP edge function (service_role, no user JWT) can
-- bcrypt-hash an aula password before inserting it directly — mirrors what
-- set_aula_password does for the authenticated teacher-app path, without
-- reusing that RPC's auth.uid() ownership check (service_role calls have no
-- JWT subject to check against). Restricted to service_role only: this is a
-- bare hashing primitive with no ownership semantics of its own.
create or replace function public.bcrypt_hash_service(p_plain text)
returns text
language sql
security invoker
set search_path to 'public'
as $function$
  select case when p_plain is null or btrim(p_plain) = '' then null
              else extensions.crypt(p_plain, extensions.gen_salt('bf')) end;
$function$;

revoke all on function public.bcrypt_hash_service(text) from public, anon, authenticated;
grant execute on function public.bcrypt_hash_service(text) to service_role;
