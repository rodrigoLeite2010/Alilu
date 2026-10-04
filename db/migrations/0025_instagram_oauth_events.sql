-- Diagnóstico do login do Instagram (Admin › Instagram / Meta): cada etapa
-- relevante do OAuth (início, callback, sucesso, cancelamento, erro). Só
-- metadados — NUNCA token, code ou state.
create table if not exists instagram_oauth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,
  stage text not null,
  outcome text not null check (outcome in ('info', 'success', 'cancelled', 'error')),
  error_code text,
  error_subcode text,
  error_type text,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists instagram_oauth_events_created_idx on instagram_oauth_events (created_at desc);
