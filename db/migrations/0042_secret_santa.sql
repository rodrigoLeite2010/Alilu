-- Módulo AMIGO SECRETO. Migração ADITIVA e idempotente.
-- Privacidade: o sorteio só é lido pelo backend, sempre filtrado pelo usuário autenticado.
-- O sorteio é gravado em UM comando SQL atômico (driver HTTP do Neon não tem BEGIN/COMMIT);
-- as constraints abaixo garantem: ninguém tira a si mesmo, cada pessoa tira 1 e é tirada 1 vez.

create table if not exists secret_santa_groups (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  event_date date,
  join_deadline date,
  budget_min_cents int check (budget_min_cents is null or budget_min_cents >= 0),
  budget_max_cents int check (budget_max_cents is null or budget_max_cents >= 0),
  currency text not null default 'BRL',
  location text check (location is null or char_length(location) <= 200),
  rules_text text check (rules_text is null or char_length(rules_text) <= 1500),
  status text not null default 'OPEN'
    check (status in ('DRAFT', 'OPEN', 'READY_TO_DRAW', 'DRAWN', 'COMPLETED', 'CANCELLED')),
  allow_anonymous_messages boolean not null default true,
  allow_wish_list boolean not null default true,
  allow_gift_preferences boolean not null default true,
  allow_participant_invites boolean not null default false,
  allow_owner_see_draw boolean not null default false,
  allow_redraw boolean not null default true,
  reveal_mode text not null default 'MANUAL' check (reveal_mode in ('MANUAL', 'AUTOMATIC', 'NEVER')),
  reveal_at date,
  avoid_previous boolean not null default false,
  previous_group_id uuid references secret_santa_groups (id) on delete set null,
  -- link genérico do grupo (token imprevisível, 32 bytes base64url)
  invite_token text not null unique,
  draw_version int not null default 0,
  drawn_at timestamptz,
  revealed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_max_cents is null or budget_min_cents is null or budget_max_cents >= budget_min_cents)
);
create index if not exists secret_santa_groups_owner_idx on secret_santa_groups (owner_user_id, status);

create table if not exists secret_santa_participants (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references secret_santa_groups (id) on delete cascade,
  user_id uuid references users (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  email text check (email is null or char_length(email) <= 200),
  phone text check (phone is null or char_length(phone) <= 30),
  invite_token text not null unique,
  status text not null default 'INVITED' check (status in ('INVITED', 'ACCEPTED', 'DECLINED', 'REMOVED')),
  is_organizer boolean not null default false,
  copied_from_participant_id uuid,
  joined_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists secret_santa_participants_group_idx on secret_santa_participants (group_id, status);
create index if not exists secret_santa_participants_user_idx on secret_santa_participants (user_id) where user_id is not null;
create index if not exists secret_santa_participants_email_idx on secret_santa_participants (lower(email)) where email is not null;
-- uma conta não ocupa duas vagas ativas no mesmo grupo
create unique index if not exists secret_santa_participants_user_uniq
  on secret_santa_participants (group_id, user_id)
  where user_id is not null and status in ('INVITED', 'ACCEPTED');

create table if not exists secret_santa_restrictions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references secret_santa_groups (id) on delete cascade,
  participant_id uuid not null references secret_santa_participants (id) on delete cascade,
  cannot_draw_participant_id uuid not null references secret_santa_participants (id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 120),
  created_at timestamptz not null default now(),
  check (participant_id <> cannot_draw_participant_id),
  unique (participant_id, cannot_draw_participant_id)
);
create index if not exists secret_santa_restrictions_group_idx on secret_santa_restrictions (group_id);

-- Resultado do sorteio. Versões antigas ficam como histórico (invalidated_at preenchido).
create table if not exists secret_santa_assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references secret_santa_groups (id) on delete cascade,
  giver_participant_id uuid not null references secret_santa_participants (id) on delete cascade,
  receiver_participant_id uuid not null references secret_santa_participants (id) on delete cascade,
  draw_version int not null,
  invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  check (giver_participant_id <> receiver_participant_id),
  unique (group_id, draw_version, giver_participant_id),
  unique (group_id, draw_version, receiver_participant_id)
);
create index if not exists secret_santa_assignments_giver_idx on secret_santa_assignments (giver_participant_id) where invalidated_at is null;
create index if not exists secret_santa_assignments_receiver_idx on secret_santa_assignments (receiver_participant_id) where invalidated_at is null;

create table if not exists secret_santa_wishes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references secret_santa_groups (id) on delete cascade,
  participant_id uuid not null references secret_santa_participants (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (description is null or char_length(description) <= 500),
  url text check (url is null or char_length(url) <= 500),
  estimated_price_cents int check (estimated_price_cents is null or estimated_price_cents >= 0),
  priority smallint not null default 2 check (priority between 1 and 3),
  -- "comprado" é marcado por quem tirou a pessoa e NUNCA é exposto ao dono do desejo
  purchased boolean not null default false,
  purchased_at timestamptz,
  public_to_group boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists secret_santa_wishes_participant_idx on secret_santa_wishes (participant_id);

create table if not exists secret_santa_gift_preferences (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references secret_santa_groups (id) on delete cascade,
  participant_id uuid not null references secret_santa_participants (id) on delete cascade,
  clothing_size text check (clothing_size is null or char_length(clothing_size) <= 30),
  shoe_size text check (shoe_size is null or char_length(shoe_size) <= 30),
  favorite_colors text check (favorite_colors is null or char_length(favorite_colors) <= 200),
  likes text check (likes is null or char_length(likes) <= 500),
  avoid text check (avoid is null or char_length(avoid) <= 500),
  notes text check (notes is null or char_length(notes) <= 500),
  updated_at timestamptz not null default now(),
  unique (group_id, participant_id)
);

-- Conversa anônima = mensagens presas a uma atribuição (quem tirou ↔ quem foi tirado).
-- Não guarda remetente: só o papel (from_giver). Quem lê a conversa como "tirado" nunca recebe identidade.
create table if not exists secret_santa_messages (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references secret_santa_assignments (id) on delete cascade,
  from_giver boolean not null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists secret_santa_messages_assignment_idx on secret_santa_messages (assignment_id, created_at);

-- Presente escolhido: privado de quem tirou.
create table if not exists secret_santa_gifts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references secret_santa_assignments (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  price_cents int check (price_cents is null or price_cents >= 0),
  notes text check (notes is null or char_length(notes) <= 500),
  purchased boolean not null default false,
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists secret_santa_announcements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references secret_santa_groups (id) on delete cascade,
  author_user_id uuid references users (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists secret_santa_announcements_group_idx on secret_santa_announcements (group_id, created_at desc);

-- Notificações internas (texto genérico: nunca carregam quem tirou quem).
create table if not exists secret_santa_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  group_id uuid references secret_santa_groups (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists secret_santa_notifications_user_idx on secret_santa_notifications (user_id, created_at desc);

-- Auditoria. meta só com contagens/ids de versão — NUNCA o resultado do sorteio.
create table if not exists secret_santa_audit_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references secret_santa_groups (id) on delete cascade,
  actor_user_id uuid references users (id) on delete set null,
  event text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists secret_santa_audit_group_idx on secret_santa_audit_events (group_id, created_at desc);
