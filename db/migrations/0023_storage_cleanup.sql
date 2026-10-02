-- Limpeza automática do Vercel Blob (arquivos temporários, órfãos e
-- vencidos) + histórico das execuções. Começa em MODO SIMULAÇÃO
-- (dry_run = true): a primeira execução só RELATA o que apagaria; o admin
-- confere em /admin/armazenamento e desliga a simulação.

create table if not exists storage_cleanup_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default true,
  dry_run boolean not null default true,
  -- Arquivo enviado e nunca registrado no banco (upload abandonado, linha apagada…): apagar depois disto.
  orphan_grace_hours int not null default 24,
  -- Resultado do Split-Screen (videos/outputs/, sem registro no banco).
  split_screen_output_days int not null default 3,
  -- Arquivos importados do Instagram (videos/imports/).
  instagram_import_days int not null default 7,
  -- Imagens de entrada do vídeo com IA (ai-video/*/input/) sem uso em andamento.
  ai_video_input_days int not null default 30,
  max_deletes_per_run int not null default 500,
  updated_at timestamptz not null default now()
);
insert into storage_cleanup_settings (id) values (1) on conflict (id) do nothing;

create table if not exists storage_cleanup_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('CRON', 'ADMIN')),
  dry_run boolean not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  deleted_files int not null default 0,
  deleted_bytes bigint not null default 0,
  -- Por regra: { scanned, matched, deleted, bytes } + uso total por pasta.
  report jsonb not null default '{}'::jsonb,
  error text
);
create index if not exists storage_cleanup_runs_started_idx on storage_cleanup_runs (started_at desc);

-- Importação do Instagram vencida (arquivo apagado pela retenção).
alter table instagram_media_imports drop constraint if exists instagram_media_imports_status_check;
alter table instagram_media_imports add constraint instagram_media_imports_status_check check (status in (
  'PENDING', 'RESOLVING', 'READY', 'IMPORTING', 'COMPLETED', 'FAILED', 'UNSUPPORTED', 'PRIVATE_CONTENT', 'INVALID_URL', 'EXPIRED'
));

-- "Excluir vídeo" no vídeo com IA: apaga o MP4 do Blob e esconde do
-- histórico; a linha fica (extrato de créditos e métricas do admin).
alter table ai_video_generations add column if not exists user_deleted_at timestamptz;
