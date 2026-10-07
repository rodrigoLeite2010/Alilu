-- Carrossel Inteligente (Fase 3): pesquisa guardada no projeto, análise de
-- perfil vinculada e contagem de buscas web (custo) por uso de IA.
-- Migração ADITIVA e idempotente.
alter table carousel_projects add column if not exists research jsonb not null default '{}'::jsonb;
alter table carousel_projects add column if not exists profile_analysis_id uuid references carousel_profile_analyses (id) on delete set null;
-- Buscas web feitas na chamada (a Anthropic cobra por busca, além dos tokens).
alter table generation_usage add column if not exists web_searches int not null default 0;
