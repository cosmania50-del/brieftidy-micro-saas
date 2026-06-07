create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  briefs_used integer not null default 0 check (briefs_used >= 0),
  stripe_test_customer_id text,
  stripe_test_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users cannot write profiles directly" on public.profiles;
create policy "Users cannot write profiles directly"
on public.profiles
for all
to authenticated
using (false)
with check (false);
