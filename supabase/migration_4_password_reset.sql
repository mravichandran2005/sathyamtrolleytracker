-- ============================================================================
-- MIGRATION 4 — Master-mediated password reset (no email needed)
-- Additive only.
-- ============================================================================

alter table profiles add column if not exists reset_requested boolean not null default false;
alter table profiles add column if not exists reset_requested_at timestamptz;
alter table profiles add column if not exists must_change_password boolean not null default false;

-- Called from the login screen by someone who isn't authenticated yet, so it
-- must be able to run without a session. It only ever flags a request — it
-- can't itself change anything security-sensitive.
create or replace function public.request_password_reset(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set reset_requested = true, reset_requested_at = now()
  where id = (select id from auth.users where lower(email) = lower(trim(p_email)));
end;
$$;

grant execute on function public.request_password_reset(text) to anon, authenticated;

-- Called by the logged-in user themselves right after they've set a real
-- password, to clear the forced-change flag. Only touches their own row.
create or replace function public.clear_must_change_password()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set must_change_password = false, reset_requested = false, reset_requested_at = null
  where id = auth.uid();
end;
$$;

grant execute on function public.clear_must_change_password() to authenticated;
