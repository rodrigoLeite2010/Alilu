-- Additive only. Apply through the existing migration runner before cloud saving.
create table if not exists travel_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  plan jsonb not null check (jsonb_typeof(plan) = 'object' and octet_length(plan::text) <= 250000),
  archived boolean not null default false,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists travel_plans_user_idx on travel_plans(user_id, updated_at desc);
-- One rolling quota row per user; atomic UPSERT works across serverless instances.
create table if not exists travel_route_quotas (
  user_id uuid primary key references users(id) on delete cascade,
  window_start timestamptz not null default now(),
  calls integer not null default 0
);
