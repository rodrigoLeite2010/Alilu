-- Sugestões de novas ferramentas enviadas pelos visitantes.
-- Conteúdo público e não sensível: não pedir dados pessoais neste fluxo.

create table if not exists suggestions (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  page_path text,
  user_agent text,
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'planned', 'done', 'ignored')),
  created_at timestamptz not null default now()
);

create index if not exists suggestions_created_at_idx
  on suggestions (created_at desc);
