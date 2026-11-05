create table music_songs (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  data jsonb not null check (octet_length(data::text) <= 260000),
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
create index music_songs_owner on music_songs(user_id, updated_at desc);

create table music_sets (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  data jsonb not null check (octet_length(data::text) <= 65000),
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  played_at timestamptz
);
create index music_sets_owner on music_sets(user_id, updated_at desc);

create table music_live (
  id uuid primary key,
  set_id uuid not null references music_sets(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  controller uuid not null,
  code text not null unique,
  program jsonb not null check (octet_length(program::text) <= 1500000),
  state jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default now() + interval '12 hours',
  ended boolean not null default false
);
create index music_live_owner on music_live(user_id, updated_at desc);
create index music_live_expiry on music_live(expires_at);

create table music_live_devices (
  session_id uuid not null references music_live(id) on delete cascade,
  device uuid not null,
  participant uuid not null default gen_random_uuid() unique,
  user_id uuid not null references users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  seen_at timestamptz not null default now(),
  primary key (session_id, device)
);

create table music_quotas (
  user_id uuid not null references users(id) on delete cascade,
  bucket text not null,
  window_start timestamptz not null default now(),
  calls integer not null default 1,
  primary key (user_id, bucket)
);
