-- Agendador de publicações do Instagram + Posts Virais.
--
-- Migração ADITIVA e segura para produção: só acrescenta colunas com
-- valor padrão (ou anuláveis) e índices. Nenhum dado existente é
-- apagado ou reescrito, e nenhuma coluna existente muda de tipo.
--
-- `instagram_posts` continua sendo a entidade "publicação" (o
-- InstagramPublication do enunciado). Colunas que já existiam e passam a
-- ser usadas pelo scheduler:
--   - attempts_count             -> retryCount (falhas temporárias acumuladas)
--   - processing_lock_token      -> dono atual do "claim" (uuid aleatório)
--   - processing_lock_expires_at -> quando o claim expira (worker travado)
--   - scheduled_at_utc           -> sempre UTC (timestamptz)
--   - timezone_original          -> fuso IANA do usuário ao agendar

alter table instagram_posts
  add column if not exists source text not null default 'MANUAL';

-- A constraint é criada à parte (e só se ainda não existir) para a
-- migração poder ser reaplicada sem erro em bancos parcialmente migrados.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'instagram_posts_source_check'
  ) then
    alter table instagram_posts
      add constraint instagram_posts_source_check check (source in ('MANUAL', 'VIRAL_POST'));
  end if;
end $$;

alter table instagram_posts add column if not exists template_id text;
-- Estado do editor (sem blob: URLs e sem nenhum segredo) para reabrir e
-- editar a arte depois. Imagens ficam no storage; aqui só URLs públicas.
alter table instagram_posts add column if not exists template_data jsonb;
-- Próxima tentativa permitida (backoff de retry ou retomada de container
-- ainda em processamento na Meta). Nulo = pode tentar já.
alter table instagram_posts add column if not exists next_attempt_at timestamptz;
alter table instagram_posts add column if not exists last_attempt_at timestamptz;
alter table instagram_posts add column if not exists processing_started_at timestamptz;

-- Busca do scheduler: agendados vencidos e processamentos a retomar.
create index if not exists instagram_posts_scheduler_idx
  on instagram_posts (status, scheduled_at_utc, next_attempt_at);
