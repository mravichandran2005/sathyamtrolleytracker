-- ============================================================================
-- MIGRATION 3 — period tracking (fixes: closing late must not drop data)
-- Additive only — doesn't touch anything you already have.
--
-- Problem this fixes: without this, the app used today's calendar date to
-- decide "the current month," so if you didn't close on time, the moment the
-- calendar rolled into the next month your still-open transactions would
-- silently vanish from the dashboard (not deleted, just invisible) because
-- there was no opening stock set for the new month yet.
--
-- Fix: a single row tracks which month the app is actually working with.
-- It only advances when Master clicks "Close month" — never on its own from
-- the calendar. Being late to close is now completely safe.
-- ============================================================================

create table if not exists app_settings (
  id smallint primary key default 1,
  current_period date not null default date_trunc('month', now())::date,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into app_settings (id, current_period)
values (1, date_trunc('month', now())::date)
on conflict (id) do nothing;

alter table app_settings enable row level security;

drop policy if exists "logged in reads app settings" on app_settings;
create policy "logged in reads app settings" on app_settings for select
  using (auth.uid() is not null);

drop policy if exists "master manages app settings" on app_settings;
create policy "master manages app settings" on app_settings for all
  using (public.my_role() = 'master') with check (public.my_role() = 'master');
