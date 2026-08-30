-- ============================================================================
-- TROLLEY TRACKER — Supabase schema (v2)
-- This REPLACES the old schema (moves companies/trolley types/vehicles from
-- random UUIDs to plain sequential numbers, adds vehicles, opening stock,
-- monthly close-out, and full Master edit access).
--
-- If you already ran the old schema.sql: this file starts by dropping
-- everything, so just run this whole file fresh in the SQL Editor. Since you
-- haven't onboarded real users/transactions yet, this is safe — you'll just
-- need to re-run the "make yourself Master" step afterwards.
-- ============================================================================

drop view if exists company_stock;
drop table if exists app_settings cascade;
drop table if exists my_company_monthly_summary cascade;
drop table if exists my_company_opening_stock cascade;
drop table if exists mismatch_reports cascade;
drop table if exists monthly_summary cascade;
drop table if exists opening_stock cascade;
drop table if exists transaction_items cascade;
drop table if exists transactions cascade;
drop table if exists profiles cascade;
drop table if exists vehicles cascade;
drop table if exists trolley_types cascade;
drop table if exists companies cascade;
drop function if exists public.handle_new_user cascade;
drop function if exists public.my_role cascade;
drop function if exists public.my_company cascade;

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- COMPANIES, TROLLEY TYPES, VEHICLES — plain sequential IDs (1, 2, 3…)
-- ----------------------------------------------------------------------------
create table companies (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table trolley_types (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into trolley_types (name) values ('Box trolley'), ('Wire trolley'), ('Bin');

create table vehicles (
  id bigint generated always as identity primary key,
  number text not null unique,   -- vehicle registration number, e.g. "TN 09 AB 1234"
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- PROFILES  (one row per login, extends Supabase auth.users)
-- role: 'pending' | 'master' | 'my_company' | 'partner'
-- active = false blocks all app access without deleting the account/history
-- ----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'pending' check (role in ('pending','master','my_company','partner')),
  company_id bigint references companies(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- role() returns null for deactivated users, which automatically locks them
-- out of every role-gated policy below without touching their login.
create function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select case when active then role else null end from profiles where id = auth.uid();
$$;

create function public.my_company() returns bigint
language sql stable security definer set search_path = public as $$
  select company_id from profiles where id = auth.uid() and active;
$$;

-- ----------------------------------------------------------------------------
-- TRANSACTIONS
-- direction: 'outbound' = My Company -> Partner | 'inbound' = Partner -> My Company
-- status: 'pending' | 'acknowledged' | 'mismatch'
-- ----------------------------------------------------------------------------
create table transactions (
  id uuid primary key default gen_random_uuid(),
  company_id bigint not null references companies(id),
  vehicle_id bigint references vehicles(id),
  direction text not null check (direction in ('outbound','inbound')),
  status text not null default 'pending' check (status in ('pending','acknowledged','mismatch')),
  created_by uuid not null references profiles(id),
  note text,
  acknowledged_by uuid references profiles(id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create table transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  trolley_type_id bigint not null references trolley_types(id),
  sent_qty int not null default 0 check (sent_qty >= 0),
  received_qty int check (received_qty >= 0)
);

-- ----------------------------------------------------------------------------
-- MISMATCH REPORTS — raised automatically when received_qty != sent_qty
-- ----------------------------------------------------------------------------
create table mismatch_reports (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  raised_by uuid not null references profiles(id),
  description text,
  status text not null default 'open' check (status in ('open','resolved')),
  resolution_note text,
  resolved_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ----------------------------------------------------------------------------
-- OPENING STOCK — Master declares this at the start of each month, from a
-- physical count. "month" is always stored as the 1st of that month.
-- ----------------------------------------------------------------------------
create table opening_stock (
  id bigint generated always as identity primary key,
  company_id bigint not null references companies(id),
  trolley_type_id bigint not null references trolley_types(id),
  month date not null,
  qty int not null default 0,
  set_by uuid references profiles(id),
  set_at timestamptz not null default now(),
  unique (company_id, trolley_type_id, month)
);

-- ----------------------------------------------------------------------------
-- MONTHLY SUMMARY — a tiny snapshot written when Master closes a month, so
-- charts/history survive even after that month's transactions are purged.
-- ----------------------------------------------------------------------------
create table monthly_summary (
  id bigint generated always as identity primary key,
  company_id bigint not null references companies(id),
  trolley_type_id bigint not null references trolley_types(id),
  month date not null,
  opening_qty int not null default 0,
  dispatched_qty int not null default 0,
  returned_qty int not null default 0,
  closing_qty int not null default 0,
  mismatch_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, trolley_type_id, month)
);

-- ----------------------------------------------------------------------------
-- MY COMPANY'S OWN INVENTORY — mirrors opening_stock / monthly_summary above,
-- but for your own warehouse rather than a partner company. There's only one
-- "my company", so no company_id column — just one row per trolley type per month.
-- ----------------------------------------------------------------------------
create table my_company_opening_stock (
  id bigint generated always as identity primary key,
  trolley_type_id bigint not null references trolley_types(id),
  month date not null,
  qty int not null default 0,
  set_by uuid references profiles(id),
  set_at timestamptz not null default now(),
  unique (trolley_type_id, month)
);

create table my_company_monthly_summary (
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

-- ----------------------------------------------------------------------------
-- APP SETTINGS — tracks which month the app is actually working with. Only
-- advances when Master closes a month, never automatically from the
-- calendar, so closing late never drops data from view.
-- ----------------------------------------------------------------------------
create table app_settings (
  id smallint primary key default 1,
  current_period date not null default date_trunc('month', now())::date,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);
insert into app_settings (id, current_period) values (1, date_trunc('month', now())::date);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table companies enable row level security;
alter table trolley_types enable row level security;
alter table vehicles enable row level security;
alter table profiles enable row level security;
alter table transactions enable row level security;
alter table transaction_items enable row level security;
alter table mismatch_reports enable row level security;
alter table opening_stock enable row level security;
alter table monthly_summary enable row level security;
alter table my_company_opening_stock enable row level security;
alter table my_company_monthly_summary enable row level security;
alter table app_settings enable row level security;

-- PROFILES ------------------------------------------------------------------
create policy "read own profile" on profiles for select using (id = auth.uid());
create policy "master reads all profiles" on profiles for select using (public.my_role() = 'master');
create policy "master updates all profiles" on profiles for update using (public.my_role() = 'master');

-- COMPANIES / TROLLEY TYPES / VEHICLES ---------------------------------------
create policy "logged in reads companies" on companies for select using (auth.uid() is not null);
create policy "master manages companies" on companies for all using (public.my_role() = 'master');

create policy "logged in reads trolley types" on trolley_types for select using (auth.uid() is not null);
create policy "master manages trolley types" on trolley_types for all using (public.my_role() = 'master');

create policy "logged in reads vehicles" on vehicles for select using (auth.uid() is not null);
create policy "master manages vehicles" on vehicles for all using (public.my_role() = 'master');

-- TRANSACTIONS ------------------------------------------------------------------
create policy "master full access to transactions" on transactions for all
  using (public.my_role() = 'master') with check (public.my_role() = 'master');

create policy "my_company reads all transactions" on transactions for select
  using (public.my_role() = 'my_company');

create policy "partner reads own company transactions" on transactions for select
  using (public.my_role() = 'partner' and company_id = public.my_company());

create policy "my_company creates outbound" on transactions for insert
  with check (public.my_role() = 'my_company' and direction = 'outbound' and created_by = auth.uid());

create policy "partner creates inbound for own company" on transactions for insert
  with check (public.my_role() = 'partner' and direction = 'inbound'
              and company_id = public.my_company() and created_by = auth.uid());

create policy "my_company acknowledges inbound" on transactions for update
  using (public.my_role() = 'my_company' and direction = 'inbound');

create policy "partner acknowledges own outbound" on transactions for update
  using (public.my_role() = 'partner' and direction = 'outbound' and company_id = public.my_company());

-- TRANSACTION ITEMS -------------------------------------------------------------
create policy "master full access to items" on transaction_items for all
  using (public.my_role() = 'master') with check (public.my_role() = 'master');

create policy "read items if you can read parent transaction" on transaction_items for select
  using (exists (select 1 from transactions t where t.id = transaction_id));

create policy "insert items with own transaction" on transaction_items for insert
  with check (exists (
    select 1 from transactions t where t.id = transaction_id and t.created_by = auth.uid()
  ));

create policy "update items when acknowledging" on transaction_items for update
  using (exists (
    select 1 from transactions t
    where t.id = transaction_id
    and (
      (public.my_role() = 'my_company' and t.direction = 'inbound')
      or (public.my_role() = 'partner' and t.direction = 'outbound' and t.company_id = public.my_company())
    )
  ));

-- MISMATCH REPORTS ---------------------------------------------------------------
create policy "master full access to reports" on mismatch_reports for all
  using (public.my_role() = 'master') with check (public.my_role() = 'master');
create policy "raiser reads own report" on mismatch_reports for select using (raised_by = auth.uid());
create policy "anyone acknowledging can raise a report" on mismatch_reports for insert
  with check (raised_by = auth.uid());

-- OPENING STOCK / MONTHLY SUMMARY -------------------------------------------------
create policy "logged in reads opening stock" on opening_stock for select using (auth.uid() is not null);
create policy "master manages opening stock" on opening_stock for all
  using (public.my_role() = 'master') with check (public.my_role() = 'master');

create policy "logged in reads monthly summary" on monthly_summary for select using (auth.uid() is not null);
create policy "master manages monthly summary" on monthly_summary for all
  using (public.my_role() = 'master') with check (public.my_role() = 'master');

-- MY COMPANY'S OWN INVENTORY — visible to Master and your own staff only,
-- never to partner company logins.
create policy "master and my_company read own opening stock" on my_company_opening_stock for select
  using (public.my_role() in ('master','my_company'));
create policy "master manages own opening stock" on my_company_opening_stock for all
  using (public.my_role() = 'master') with check (public.my_role() = 'master');

create policy "master and my_company read own monthly summary" on my_company_monthly_summary for select
  using (public.my_role() in ('master','my_company'));
create policy "master manages own monthly summary" on my_company_monthly_summary for all
  using (public.my_role() = 'master') with check (public.my_role() = 'master');

-- APP SETTINGS --------------------------------------------------------------
create policy "logged in reads app settings" on app_settings for select
  using (auth.uid() is not null);
create policy "master manages app settings" on app_settings for all
  using (public.my_role() = 'master') with check (public.my_role() = 'master');
