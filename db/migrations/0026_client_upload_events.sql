-- Diagnóstico de envio de arquivos pelo navegador (principalmente celular):
-- cada etapa do upload (abriu o seletor, escolheu, validou, enviou, falhou).
-- Só metadados: tipo/tamanho/extensão do arquivo, navegador, etapa, erro.
-- Nunca o conteúdo nem o nome completo do arquivo.
create table if not exists client_upload_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,
  page_session text,
  tool text not null,
  stage text not null,
  file_type text,
  file_ext text,
  file_size bigint,
  message text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists client_upload_events_created_idx on client_upload_events (created_at desc);
