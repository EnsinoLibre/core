-- Key expiry (issue #47): a leaked elk_... bearer token was valid forever
-- until manually revoked. Optional expires_at, nullable = never expires.
alter table public.agent_keys
  add column if not exists expires_at timestamptz;
