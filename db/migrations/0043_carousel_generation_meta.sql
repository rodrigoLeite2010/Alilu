-- Carrossel Inteligente: categoria/tema/estrutura/convite escolhidos em cada geração
-- (alimenta a anti-repetição por categoria e o diagnóstico) + cache de buscas de fotos.
-- ADITIVA e idempotente.

alter table carousel_projects add column if not exists generation_meta jsonb not null default '{}'::jsonb;
create index if not exists carousel_projects_automation_recent_idx on carousel_projects (automation_id, created_at desc) where automation_id is not null;

-- Cache de busca no banco de fotos (provedor + consulta normalizada). Só resultados públicos; sem dado de usuário.
create table if not exists carousel_photo_search_cache (
  provider text not null,
  query text not null,
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (provider, query)
);
create index if not exists carousel_photo_search_cache_created_idx on carousel_photo_search_cache (created_at);
