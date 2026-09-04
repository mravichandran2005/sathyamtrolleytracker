-- ============================================================================
-- MIGRATION 6 — Web push notifications
-- Additive only.
-- ============================================================================

create table if not exists push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table push_subscriptions enable row level security;

-- Users manage only their own subscription (created from their own browser).
create policy "read own push subscriptions" on push_subscriptions for select
  using (user_id = auth.uid());
create policy "insert own push subscriptions" on push_subscriptions for insert
  with check (user_id = auth.uid());
create policy "delete own push subscriptions" on push_subscriptions for delete
  using (user_id = auth.uid());

-- The notify-pending Edge Function reads across all users using the
-- service-role key, which bypasses RLS entirely — no extra policy needed
-- for that.
