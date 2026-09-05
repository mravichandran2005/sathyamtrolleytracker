-- ============================================================================
-- MIGRATION 5 — display names + company-scoped stock visibility
-- Additive only.
-- ============================================================================

-- A view exposing ONLY id + name (nothing else — no role, no company, no
-- reset flags) so any logged-in user can see who created or acknowledged a
-- transaction, without being able to read anyone's full profile.
create or replace view profile_names as
select id, full_name from profiles;

grant select on profile_names to authenticated;

-- Opening stock and monthly summaries were previously readable in full by
-- anyone logged in. Tighten this: partner company staff should only ever
-- see their OWN company's stock figures, never another partner's.
drop policy if exists "logged in reads opening stock" on opening_stock;
create policy "master and my_company read all opening stock" on opening_stock for select
  using (public.my_role() in ('master','my_company'));
create policy "partner reads own opening stock" on opening_stock for select
  using (public.my_role() = 'partner' and company_id = public.my_company());

drop policy if exists "logged in reads monthly summary" on monthly_summary;
create policy "master and my_company read all monthly summary" on monthly_summary for select
  using (public.my_role() in ('master','my_company'));
create policy "partner reads own monthly summary" on monthly_summary for select
  using (public.my_role() = 'partner' and company_id = public.my_company());
