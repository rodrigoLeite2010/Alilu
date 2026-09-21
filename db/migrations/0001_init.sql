-- Migração inicial do módulo de publicação automática do Instagram (Fase 3).
--
-- Contexto: o projeto é multiusuário desde o início (login por Google ou por
-- código de e-mail) — cada usuário conecta a própria conta profissional do
-- Instagram. Enquanto o App Review da Meta não aprova o uso público de
-- `instagram_business_content_publish`, só contas cadastradas como "tester"
-- no painel do app conseguem de fato concluir a conexão (isso é imposto pela
-- própria Meta no momento do OAuth, não precisa de lógica adicional aqui).
--
-- Convenções:
--   - Toda data/hora é armazenada em UTC (timestamptz). A tela mostra o
--     horário em America/Sao_Paulo e converte na hora de gravar/exibir.
--   - Nenhum segredo (token de acesso da Meta) é armazenado em texto puro:
--     `access_token_encrypted` guarda o resultado de AES-256-GCM aplicado
--     em lib/instagram/backend/encryption.ts, com a chave só no servidor
--     (variável de ambiente INSTAGRAM_TOKEN_ENCRYPTION_KEY).
--   - IDs são uuid gerados no banco (gen_random_uuid(), extensão pgcrypto).

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  avatar_url text,
  google_id text unique,
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Códigos de login por e-mail (OTP). Não tem FK pra users: o código é
-- pedido/validado ANTES de sabermos se o e-mail já tem conta (o usuário é
-- criado no primeiro login bem-sucedido).
create table if not exists login_otp_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists login_otp_codes_email_idx
  on login_otp_codes (email, expires_at desc);

create table if not exists instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  ig_user_id text not null,
  ig_username text,
  access_token_encrypted text not null,
  token_expires_at timestamptz,
  scopes text,
  status text not null default 'connected'
    check (status in ('connected', 'expired', 'revoked', 'error')),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists instagram_accounts_user_idx
  on instagram_accounts (user_id);

create table if not exists instagram_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  storage_url text not null,
  storage_provider text not null default 'vercel-blob',
  media_type text not null check (media_type in ('image', 'video')),
  width int,
  height int,
  duration_seconds numeric,
  file_size_bytes bigint,
  original_filename text,
  created_at timestamptz not null default now()
);

create index if not exists instagram_media_user_idx
  on instagram_media (user_id);

create table if not exists instagram_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  instagram_account_id uuid not null references instagram_accounts (id) on delete cascade,
  post_type text not null check (post_type in ('image', 'carousel', 'reels')),
  caption text not null default '',
  status text not null default 'DRAFT' check (status in (
    'DRAFT', 'SCHEDULED', 'PROCESSING', 'PUBLISHED', 'FAILED', 'CANCELLED', 'NEEDS_REVIEW'
  )),
  scheduled_at_utc timestamptz,
  timezone_original text not null default 'America/Sao_Paulo',
  attempts_count int not null default 0,
  meta_container_id text,
  meta_media_id text,
  last_error_sanitized text,
  published_at timestamptz,
  processing_lock_token text,
  processing_lock_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists instagram_posts_user_idx
  on instagram_posts (user_id);

create index if not exists instagram_posts_due_idx
  on instagram_posts (status, scheduled_at_utc);

create table if not exists instagram_post_items (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references instagram_posts (id) on delete cascade,
  media_id uuid not null references instagram_media (id) on delete restrict,
  position int not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists instagram_post_items_post_idx
  on instagram_post_items (post_id, position);

create table if not exists instagram_publish_attempts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references instagram_posts (id) on delete cascade,
  attempted_at timestamptz not null default now(),
  outcome text not null check (outcome in ('success', 'failure', 'pending')),
  error_sanitized text,
  meta_container_id text,
  meta_media_id text
);

create index if not exists instagram_publish_attempts_post_idx
  on instagram_publish_attempts (post_id, attempted_at desc);
