-- ============================================================================
-- MIGRATION 5 — show who created / acknowledged each transaction
-- Additive only.
--
-- Regular users can currently only read their OWN profile row (by design —
-- partner companies shouldn't see each other's staff details). This function
-- exposes just id + name (nothing else — no role, no company, no email) for
-- a given set of user ids, so transaction lists can show "Dispatched by
-- Priya" without opening up full profile visibility.
-- ============================================================================

create or replace function public.get_profile_names(p_ids uuid[])
returns table(id uuid, full_name text)
language sql
security definer
set search_path = public
as $$
  select id, full_name from profiles where id = any(p_ids);
$$;

grant execute on function public.get_profile_names(uuid[]) to authenticated;
