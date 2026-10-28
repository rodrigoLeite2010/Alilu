-- Adds Instagram API with Facebook Login alongside the existing direct
-- Instagram Login flow. Existing accounts keep their provider and tokens.
alter table instagram_accounts
  add column auth_provider text not null default 'instagram_login'
    check (auth_provider in ('instagram_login', 'facebook_login')),
  add column facebook_page_id text,
  add column facebook_user_id text,
  add column facebook_user_token_encrypted text,
  add column facebook_user_token_expires_at timestamptz;

create index instagram_accounts_facebook_page_idx
  on instagram_accounts (facebook_page_id)
  where facebook_page_id is not null;

-- Short-lived, server-only OAuth attempts. The state is stored only as a
-- SHA-256 digest; the long-lived Facebook user token is encrypted at rest.
create table instagram_oauth_pending (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  correlation_id text not null unique,
  state_hash text not null unique,
  target_account_id uuid references instagram_accounts (id) on delete cascade,
  expected_ig_user_id text,
  return_to text,
  facebook_user_id text,
  facebook_user_token_encrypted text,
  facebook_user_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index instagram_oauth_pending_expiry_idx
  on instagram_oauth_pending (expires_at);
