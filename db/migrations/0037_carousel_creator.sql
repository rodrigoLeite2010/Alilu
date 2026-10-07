-- Carrossel Inteligente (Fase 2): domínio + assinatura própria.
-- Migração ADITIVA e idempotente. Nada do que existe é alterado, exceto uma
-- coluna opcional em generation_usage (custo de IA por projeto de carrossel).
--
-- Assinatura: produto SEPARADO do Piloto Automático (automation_subscriptions
-- tem user_id UNIQUE e CHECK de planos próprios). Cobrança Asaas própria
-- (Fase 6); cota reaproveita plan_usage_cycles/plan_usage_events com
-- cycle_key prefixado "carousel:" e reference_type 'CAROUSEL_PROJECT'.

-- ---------------------------------------------------------------------------
-- Assinatura do produto
-- ---------------------------------------------------------------------------
create table if not exists carousel_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users (id) on delete cascade,
  plan_code text not null check (plan_code in ('STARTER', 'PRO', 'TURBO', 'AGENCY')),
  pending_plan_code text check (pending_plan_code is null or pending_plan_code in ('STARTER', 'PRO', 'TURBO', 'AGENCY')),
  status text not null default 'PENDING_PAYMENT'
    check (status in ('PENDING_PAYMENT', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED')),
  -- Preço de tabela e preço efetivamente cobrado (com desconto de cliente Alilu), em centavos.
  list_price_cents int not null check (list_price_cents > 0),
  price_cents int not null check (price_cents > 0),
  discount_percent int not null default 0 check (discount_percent between 0 and 100),
  asaas_customer_id text,
  asaas_subscription_id text,
  cpf_cnpj text,
  complimentary boolean not null default false,
  admin_note text,
  started_at timestamptz,
  current_period_ends_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists carousel_subscriptions_asaas_idx on carousel_subscriptions (asaas_subscription_id) where asaas_subscription_id is not null;

-- ---------------------------------------------------------------------------
-- Teste grátis: 1 carrossel por pessoa. Chave por usuário E por e-mail
-- normalizado (sem pontos/+tag no Gmail) para não repetir criando registros.
-- ---------------------------------------------------------------------------
create table if not exists carousel_trial_claims (
  user_id uuid primary key references users (id) on delete cascade,
  email_key text not null unique,
  project_id uuid,
  claimed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Perfil de marca do carrossel (um por usuário; reaproveita a ideia do Stories)
-- ---------------------------------------------------------------------------
create table if not exists carousel_brand_profiles (
  user_id uuid primary key references users (id) on delete cascade,
  brand_name text,
  handle text,
  niche text,
  audience text,
  objective text,
  tone text,
  accent_color text check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$'),
  secondary_color text check (secondary_color is null or secondary_color ~ '^#[0-9a-fA-F]{6}$'),
  font_id text,
  default_template_id text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Pautas sugeridas (semanais ou sob demanda)
-- ---------------------------------------------------------------------------
create table if not exists carousel_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  -- "2026-W41": a semana da sugestão (idempotência da geração semanal).
  week_key text not null,
  niche text not null,
  title text not null,
  summary text not null default '',
  category text,
  relevance_reason text,
  narrative_angle text,
  informative_angle text,
  engagement_potential text not null default 'MEDIUM' check (engagement_potential in ('LOW', 'MEDIUM', 'HIGH')),
  status text not null default 'NEW' check (status in ('NEW', 'USED', 'DISMISSED')),
  suggested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists carousel_topics_user_idx on carousel_topics (user_id, week_key, status);

-- ---------------------------------------------------------------------------
-- Projeto de carrossel
-- ---------------------------------------------------------------------------
create table if not exists carousel_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  instagram_account_id uuid references instagram_accounts (id) on delete set null,
  topic_id uuid references carousel_topics (id) on delete set null,
  title text not null default '',
  topic text not null,
  source_kind text not null default 'TOPIC' check (source_kind in ('TOPIC', 'SUGGESTED', 'TREND', 'URL', 'PROFILE')),
  source_ref text,
  niche text,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'GENERATING', 'READY', 'SCHEDULED', 'PUBLISHED', 'FAILED')),
  slide_count int not null default 10 check (slide_count between 5 and 10),
  template_id text,
  chosen_hook_id uuid,
  caption text not null default '',
  hashtags jsonb not null default '[]'::jsonb,
  brand_snapshot jsonb not null default '{}'::jsonb,
  include_end_media boolean not null default true,
  instagram_post_id uuid references instagram_posts (id) on delete set null,
  error text,
  -- Quando o projeto virou "carrossel concluído" (cota consumida UMA vez).
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists carousel_projects_user_idx on carousel_projects (user_id, status, updated_at desc);
create index if not exists carousel_projects_account_idx on carousel_projects (user_id, instagram_account_id);

create table if not exists carousel_hooks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references carousel_projects (id) on delete cascade,
  style text not null check (style in ('ORIGINAL', 'PROVOCATIVE', 'AUTHORITY', 'STORYTELLING', 'CUSTOM')),
  headline text not null,
  subtitle text,
  objective text,
  chosen boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists carousel_hooks_project_idx on carousel_hooks (project_id);

create table if not exists carousel_slides (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references carousel_projects (id) on delete cascade,
  position int not null check (position >= 1),
  role text not null,
  headline text not null default '',
  body text not null default '',
  cta text not null default '',
  -- A IA decide o que o slide pede; o custo de imagem IA só existe em IMAGE_AI.
  visual_kind text not null default 'GRAPHIC' check (visual_kind in ('PHOTO', 'ILLUSTRATION', 'GRAPHIC', 'IMAGE_AI', 'NONE')),
  image_query text,
  image_media_id uuid references instagram_media (id) on delete set null,
  rendered_media_id uuid references instagram_media (id) on delete set null,
  template_id text,
  style jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carousel_slides_unique_position unique (project_id, position)
);

create table if not exists carousel_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references carousel_projects (id) on delete cascade,
  topic_id uuid references carousel_topics (id) on delete cascade,
  kind text not null default 'WEB' check (kind in ('WEB', 'URL', 'PROFILE')),
  title text not null,
  url text,
  publisher text,
  published_at timestamptz,
  retrieved_at timestamptz not null default now()
);
create index if not exists carousel_sources_project_idx on carousel_sources (project_id);

-- Análise de perfil/URL público: guarda só PADRÕES derivados (temas, formatos,
-- estilo de headline, frequência) — nunca o texto ou as imagens do terceiro.
create table if not exists carousel_profile_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  target text not null,
  patterns jsonb not null default '{}'::jsonb,
  analyzed_at timestamptz not null default now()
);
create index if not exists carousel_profile_analyses_user_idx on carousel_profile_analyses (user_id, analyzed_at desc);

-- Custo de IA por projeto (pauta, gancho, roteiro, legenda, pesquisa).
alter table generation_usage add column if not exists carousel_project_id uuid references carousel_projects (id) on delete set null;
create index if not exists generation_usage_carousel_idx on generation_usage (carousel_project_id) where carousel_project_id is not null;
