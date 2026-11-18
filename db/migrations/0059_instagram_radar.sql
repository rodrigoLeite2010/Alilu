-- Radar Instagram: importação por vários links + publicação automática numa
-- conta Instagram EXPLICITAMENTE escolhida, com N publicações por dia (1–10),
-- intervalo mínimo fixo e janela de horário (início/fim, dias, fuso).
--
-- Reaproveita a Fila de vídeos (0055): um radar é uma linha de video_queues
-- com kind = 'INSTAGRAM_RADAR'. Importador, worker, planejador, agendador
-- (instagram_posts) e cron (/api/cron/video-queue + /api/cron/instagram-publish)
-- são os MESMOS das filas de Games.
--
-- Migração ADITIVA e segura para produção:
--   * só acrescenta colunas com valor padrão neutro em video_queues
--     (kind = 'VIDEO_QUEUE' para TODAS as filas existentes — nada muda nelas);
--   * só cria UMA tabela nova (lock de agendamento por conta Instagram);
--   * nenhum agendamento, publicação, conta, token ou fila existente é alterado.

-- 1) Tipo da fila. Filas de Games continuam 'VIDEO_QUEUE'.
alter table video_queues add column if not exists kind text not null default 'VIDEO_QUEUE';
alter table video_queues drop constraint if exists video_queues_kind_check;
alter table video_queues add constraint video_queues_kind_check check (kind in ('VIDEO_QUEUE', 'INSTAGRAM_RADAR'));

-- 2) Janela de publicação do radar ("HH:MM", no fuso da fila). Fim < início =
--    janela que atravessa a meia-noite. Nulas nas filas de Games.
alter table video_queues add column if not exists window_start text;
alter table video_queues add column if not exists window_end text;

-- 3) Legendas do radar: hashtags fixas e o que fazer com vídeo sem legenda própria.
--    'DEFAULT' = usa a legenda padrão (neutra); 'REVIEW' = só publica depois de
--    a pessoa revisar/escrever a legenda do vídeo.
alter table video_queues add column if not exists hashtags text not null default '';
alter table video_queues add column if not exists missing_caption_policy text not null default 'DEFAULT';
alter table video_queues drop constraint if exists video_queues_missing_caption_policy_check;
alter table video_queues add constraint video_queues_missing_caption_policy_check
  check (missing_caption_policy in ('DEFAULT', 'REVIEW'));

-- 4) Regras do radar garantidas pelo PRÓPRIO banco (além do backend):
--    * só Instagram — nunca Facebook (sem Páginas, publish_to_instagram = true);
--    * 1 a 10 publicações por dia;
--    * intervalo de uma das opções oferecidas (30 min a 24 h);
--    * janela preenchida.
alter table video_queues drop constraint if exists video_queues_instagram_radar_rules_check;
alter table video_queues add constraint video_queues_instagram_radar_rules_check check (
  kind <> 'INSTAGRAM_RADAR' or (
    publish_to_instagram
    and cardinality(facebook_page_ids) = 0
    and posts_per_day between 1 and 10
    and min_interval_minutes in (30, 60, 120, 180, 240, 360, 480, 720, 1440)
    and window_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    and window_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  )
);

create index if not exists video_queues_kind_account_idx on video_queues (instagram_account_id, kind, status);

-- 5) Lock de agendamento POR CONTA Instagram: dois radares (ou um radar e uma
--    fila de Games) que usam a mesma conta nunca planejam ao mesmo tempo — o
--    limite diário combinado e o intervalo mínimo da conta são respeitados.
--    Só guarda token + expiração (nenhum dado sensível).
create table if not exists instagram_account_schedule_locks (
  instagram_account_id uuid primary key references instagram_accounts (id) on delete cascade,
  lock_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
