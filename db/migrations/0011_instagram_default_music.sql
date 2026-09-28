-- Música padrão para publicações do Instagram (aditivo — nada aqui altera
-- o comportamento de uma publicação que não usa música).
--
-- Contexto (ver relatório publicado no projeto para os detalhes da
-- pesquisa): a versão da API usada por este projeto ("Instagram API with
-- Instagram Login", graph.instagram.com — ver GRAPH_API_VERSION em
-- lib/instagram/backend/meta-graph-client.ts) NÃO expõe hoje nenhum
-- parâmetro para anexar música do catálogo do Instagram a um post de
-- imagem, carrossel, Reel ou vídeo de feed — isso só existe na "Instagram
-- API with Facebook Login" (audio_configuration, endpoint /{ig-user-id}/
-- media, e mesmo assim só para Reels; confirmado em developers.
-- facebook.com/docs/instagram-platform/content-publishing/audio-api/,
-- consultada em 28/09/2026). Por isso esta migração só cria a ESTRUTURA de
-- configuração (conta e por publicação) — nenhuma chamada nova é feita à
-- Meta. A camada de publicação (instagram-publish-service.ts) resolve a
-- música pedida, mas hoje sempre publica sem aplicá-la e registra o
-- motivo no log — nunca bloqueia nem quebra a publicação.

-- Música padrão da conta: configurada uma vez, reaproveitada em toda
-- publicação nova (a pessoa não precisa escolher de novo a cada post).
alter table instagram_accounts
  add column if not exists default_music_enabled boolean not null default false,
  add column if not exists default_music_type text not null default 'None'
    check (default_music_type in ('None', 'InstagramCatalog', 'CustomAudio')),
  add column if not exists default_music_name text,
  add column if not exists default_music_artist text,
  add column if not exists default_music_external_id text,
  add column if not exists default_music_url text,
  add column if not exists default_audio_file_url text,
  add column if not exists default_audio_file_name text;

-- Música de cada publicação: a decisão é gravada no momento da criação/
-- agendamento (nunca recalculada sozinha depois) — se a pessoa mudar a
-- música padrão da conta no futuro, publicações já agendadas com
-- MusicMode = ACCOUNT_DEFAULT continuam pegando o valor da conta em
-- vigor na hora de publicar (é "padrão da conta", não uma cópia
-- congelada); MusicMode = CUSTOM guarda sua própria escolha nas colunas
-- music_* abaixo, independente do que a conta tiver configurado.
alter table instagram_posts
  add column if not exists music_mode text not null default 'ACCOUNT_DEFAULT'
    check (music_mode in ('ACCOUNT_DEFAULT', 'NONE', 'CUSTOM')),
  add column if not exists music_type text
    check (music_type is null or music_type in ('None', 'InstagramCatalog', 'CustomAudio')),
  add column if not exists music_name text,
  add column if not exists music_artist text,
  add column if not exists music_external_id text,
  add column if not exists music_url text,
  add column if not exists audio_file_url text,
  add column if not exists audio_file_name text;

-- Todo post já existente nasce com music_mode = ACCOUNT_DEFAULT (o
-- default da coluna cobre isso na migração), mas contas antigas têm
-- default_music_enabled = false — ou seja, ACCOUNT_DEFAULT resolve para
-- "sem música", exatamente o comportamento de hoje. Nenhum post
-- existente muda de comportamento com esta migração.
