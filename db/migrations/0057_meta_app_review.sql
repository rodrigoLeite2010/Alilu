-- Meta App Review — Instagram (painel /admin/meta-app-review).
--
-- Migração ADITIVA: uma tabela nova, por administrador, que guarda a
-- sessão de gravação em andamento: início, confirmações MANUAIS do
-- checklist, resultado da última consulta real à API
-- (instagram_business_basic) e da publicação de demonstração
-- (instagram_business_content_publish). Nenhum token é guardado aqui e
-- nenhuma tabela existente é alterada.
create table if not exists meta_app_review_sessions (
  user_id uuid primary key references users (id) on delete cascade,
  started_at timestamptz not null default now(),
  -- { "<item>": "<ISO da confirmação>" } — só itens de observação humana.
  manual_checks jsonb not null default '{}'::jsonb,
  instagram_account_id uuid references instagram_accounts (id) on delete set null,
  -- Campos efetivamente devolvidos por GET /me (nada é inventado).
  profile jsonb,
  profile_checked_at timestamptz,
  profile_error text,
  -- Publicação de demonstração (instagram_posts EXISTENTE, mesmo publicador do Alilu).
  publish_post_id uuid references instagram_posts (id) on delete set null,
  -- Confirmação consultada na API depois da publicação (id, permalink, timestamp, tipo).
  publish_verified jsonb,
  publish_verified_at timestamptz,
  publish_error text,
  updated_at timestamptz not null default now()
);
