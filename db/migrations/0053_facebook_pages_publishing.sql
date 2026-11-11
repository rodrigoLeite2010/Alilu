-- Publicação direta em Páginas do Facebook (Pages API), ao lado do
-- Instagram, a partir de UMA única publicação/agendamento do Alilu.
--
-- Migração ADITIVA e segura para produção:
--   * nenhuma coluna existente muda de tipo, nenhum dado é apagado;
--   * `instagram_posts.publish_to_instagram` nasce `true` para TODAS as
--     linhas existentes — agendamentos antigos continuam exatamente como
--     estão (só Instagram). Nenhum agendamento antigo ganha Facebook.
--   * o Instagram continua usando as colunas de sempre de instagram_posts
--     (status, meta_container_id, attempts_count, lock...). O Facebook tem
--     o próprio estado por destino em social_publication_destinations, para
--     que uma falha em uma rede nunca altere (nem republique) a outra.

-- 1) Publicação "somente Facebook": o agendador do Instagram ignora a linha.
alter table instagram_posts
  add column if not exists publish_to_instagram boolean not null default true;

-- 2) Tentativas OAuth: o mesmo armazenamento server-side (state em SHA-256,
--    token cifrado) passa a distinguir o fluxo "Instagram via Facebook Login"
--    do fluxo "Páginas do Facebook". Linhas existentes = 'instagram'.
alter table instagram_oauth_pending
  add column if not exists purpose text not null default 'instagram';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'instagram_oauth_pending_purpose_check') then
    alter table instagram_oauth_pending
      add constraint instagram_oauth_pending_purpose_check check (purpose in ('instagram', 'facebook_pages'));
  end if;
end $$;

-- 3) Páginas do Facebook conectadas. Cada usuário Alilu guarda o PRÓPRIO
--    Page Access Token (obtido pelo próprio login dele, com a tarefa
--    CREATE_CONTENT/MANAGE confirmada pela Meta) — por isso a unicidade é
--    (user_id, page_id): uma Página administrada por duas pessoas pode ser
--    conectada por cada uma delas, mas nunca usa o token da outra.
create table if not exists facebook_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  page_id text not null,
  page_name text not null,
  -- Page Access Token cifrado (AES-GCM, mesma chave dos tokens do Instagram).
  -- null = desconectada pelo usuário.
  page_access_token_encrypted text,
  facebook_user_id text not null,
  tasks text,
  scopes text,
  -- Instagram profissional vinculado à Página (informativo, vindo da Meta).
  linked_ig_user_id text,
  linked_ig_username text,
  -- Conta Instagram do PRÓPRIO usuário que corresponde ao vínculo acima.
  instagram_account_id uuid references instagram_accounts (id) on delete set null,
  status text not null default 'connected'
    check (status in ('connected', 'needs_reconnect', 'revoked')),
  last_error_sanitized text,
  last_checked_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facebook_pages_user_page_unique unique (user_id, page_id)
);

create index if not exists facebook_pages_user_idx on facebook_pages (user_id);

-- 4) Destinos extras de uma publicação (hoje: Facebook). Um destino por
--    (publicação, plataforma, conta externa) — a constraint única impede
--    dois destinos iguais e, portanto, duas publicações no mesmo lugar.
create table if not exists social_publication_destinations (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references instagram_posts (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  platform text not null check (platform in ('facebook')),
  facebook_page_ref uuid references facebook_pages (id) on delete set null,
  external_account_id text not null,
  account_name text,
  -- Legenda específica do Facebook; null/vazia = usa a legenda principal.
  caption_override text,
  status text not null default 'SCHEDULED' check (status in (
    'SCHEDULED', 'PROCESSING', 'PUBLISHED', 'FAILED', 'CANCELLED', 'NEEDS_REVIEW'
  )),
  -- Fase do fluxo em etapas (Reels: started → uploaded → finished;
  -- carrossel: photos_uploaded). Retomada sem recriar nada.
  phase text,
  -- Reels: video_id devolvido pela fase "start".
  external_upload_id text,
  -- Carrossel: fotos NÃO publicadas já enviadas, na ordem do carrossel.
  external_children_ids text[],
  external_publication_id text,
  external_publication_url text,
  attempts_count int not null default 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  -- "Publicar agora"/"Tentar novamente": libera o destino independentemente
  -- do horário agendado da publicação. Agendamento/edição zeram.
  release_at timestamptz,
  -- Momento em que um POST NÃO idempotente (foto/post do feed) foi enviado
  -- e ainda não teve resultado confirmado. Enquanto preenchido, nenhuma
  -- tentativa repete o POST sem antes reconciliar com a Página.
  request_started_at timestamptz,
  published_at timestamptz,
  last_error_sanitized text,
  -- token | permission | media | copyright | rate_limit | transient |
  -- unknown_result | validation | page_disconnected | other
  last_error_reason text,
  processing_started_at timestamptz,
  processing_lock_token text,
  processing_lock_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_publication_destinations_unique unique (post_id, platform, external_account_id)
);

create index if not exists social_publication_destinations_post_idx
  on social_publication_destinations (post_id);
create index if not exists social_publication_destinations_scheduler_idx
  on social_publication_destinations (status, next_attempt_at);

-- 5) Auditoria por tentativa (só acumula, nunca sobrescreve; sem tokens).
create table if not exists social_publication_attempts (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid not null references social_publication_destinations (id) on delete cascade,
  attempted_at timestamptz not null default now(),
  trigger text,
  outcome text not null check (outcome in ('success', 'failure', 'pending', 'reconciled')),
  error_sanitized text,
  error_reason text,
  meta_code int,
  external_id text
);

create index if not exists social_publication_attempts_destination_idx
  on social_publication_attempts (destination_id, attempted_at desc);
