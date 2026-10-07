-- SmartStoryEngine: identidade visual POR USUÁRIO nos Stories inteligentes.
-- Migração ADITIVA e idempotente. Antes, logo/mascote/@alilu.tec/CTAs do
-- Alilu eram globais; agora cada conta tem o próprio perfil de marca
-- (logo, mascote, @, site, nome, cor de destaque). Quem não tem perfil NÃO
-- recebe nenhum elemento do Alilu (só a conta de administrador do próprio
-- Alilu mantém a identidade Alilu por padrão — decidido no código).
create table if not exists smart_story_brand_profiles (
  user_id uuid primary key references users (id) on delete cascade,
  brand_name text,
  handle text,
  site text,
  accent_color text,
  logo_url text,
  mascot_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
