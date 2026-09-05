-- ============================================================================
-- MIGRATION 7 — self-reported returns (My Company logs a return directly,
-- for when a partner sent trolleys back without using the app at all)
-- Additive only.
-- ============================================================================

alter table transactions add column if not exists self_reported boolean not null default false;

-- My Company can create an inbound transaction directly (bypassing the
-- normal partner-declares/my_company-confirms flow), but ONLY when flagged
-- self_reported — this keeps the normal flow's guarantees intact for every
-- transaction actually initiated by a partner.
drop policy if exists "my_company self-reports inbound" on transactions;
create policy "my_company self-reports inbound" on transactions for insert
  with check (
    public.my_role() = 'my_company' and direction = 'inbound'
    and self_reported = true and created_by = auth.uid()
  );
