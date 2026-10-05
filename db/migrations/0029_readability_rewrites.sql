-- Legibilidade — reescrita com IA (fase 2). ADITIVA. Guarda SÓ o uso (para
-- o limite diário e para o admin acompanhar), NUNCA o texto do usuário.
create table if not exists readability_rewrites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  goal text not null,
  audience text not null,
  character_count int not null,
  success boolean not null,
  error_code text,
  duration_ms int,
  score_before int,
  score_after int,
  created_at timestamptz not null default now()
);
create index if not exists readability_rewrites_user_day_idx on readability_rewrites (user_id, created_at desc);
