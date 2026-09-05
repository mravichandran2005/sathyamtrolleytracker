-- ============================================================================
-- MIGRATION 2 — My Company's own inventory (in addition to per-partner stock)
-- This is ADDITIVE ONLY — it does not touch companies, vehicles, users,
-- profiles, or any transactions you already have. Just run this once in the
-- SQL Editor on top of your existing database.
-- ============================================================================

create table if not exists my_company_opening_stock (
  id bigint generated always as identity primary key,
  trolley_type_id bigint not null references trolley_types(id),
  month date not null,
  qty int not null default 0,
  set_by uuid references profiles(id),
  set_at timestamptz not null default now(),
  unique (trolley_type_id, month)
);

create table if not exists my_company_monthly_summary (
  id bigint generated always as identity primary key,
  trolley_type_id bigint not null references trolley_types(id),
  month date not null,
  opening_qty int not null default 0,
  dispatched_qty int not null default 0,  -- left my company (outbound, all partners combined)
  returned_qty int not null default 0,    -- came back to my company (inbound, all partners combined)
  closing_qty int not null default 0,
  created_at timestamptz not null default now(),
  unique (trolley_type_id, month)
);

alter table my_company_opening_stock enable row level security;
alter table my_company_monthly_summary enable row level security;

-- Visible to Master and your own staff; partner companies never see your
-- internal inventory.
drop policy if exists "master and my_company read own opening stock" on my_company_opening_stock;
create policy "master and my_company read own opening stock" on my_company_opening_stock for select
  using (public.my_role() in ('master','my_company'));

drop policy if exists "master manages own opening stock" on my_company_opening_stock;
create policy "master manages own opening stock" on my_company_opening_stock for all
  using (public.my_role() = 'master') with check (public.my_role() = 'master');

drop policy if exists "master and my_company read own monthly summary" on my_company_monthly_summary;
create policy "master and my_company read own monthly summary" on my_company_monthly_summary for select
  using (public.my_role() in ('master','my_company'));

drop policy if exists "master manages own monthly summary" on my_company_monthly_summary;
create policy "master manages own monthly summary" on my_company_monthly_summary for all
  using (public.my_role() = 'master') with check (public.my_role() = 'master');
