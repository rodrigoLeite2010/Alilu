-- Destinos sociais EXPLÍCITOS e AUTORIZADOS por publicação.
--
-- Problema corrigido: o Piloto Automático tinha um modo "Automático"
-- (content_automations.facebook_page_ids = NULL, o padrão de TODA
-- automação) que gravava como destino a Página do Facebook vinculada à
-- conta do Instagram — sem que a pessoa tivesse escolhido o Facebook.
-- Uma conta como "Se Tá Bom Pra Você" podia, assim, sair numa Página que
-- ninguém selecionou.
--
-- Regra nova (aplicada no backend em lib/facebook/backend/destination-authorization.ts):
--   * nenhuma Página é usada por inferência (token, vínculo Instagram↔Página,
--     "primeira Página", categoria...);
--   * o perfil de destinos de uma conta Instagram ("categoria") diz quais
--     Páginas são PERMITIDAS e quais são só SUGESTÃO inicial;
--   * a checagem roda ao gravar o destino E de novo imediatamente antes de
--     qualquer chamada à API do Facebook (cron, "Publicar agora", retry).
--
-- Migração ADITIVA e segura:
--   * nenhuma linha é apagada; nenhum status existente é alterado aqui;
--   * só classifica (selection_source) os destinos já existentes, para que o
--     agendador saiba quais nasceram do antigo modo "Automático".

-- 1) Perfil de destinos por conta Instagram ("categoria": Alilu, Prestador
--    Seguro, Se Tá Bom Pra Você, GTA 6...). Vinculado por IDs, nunca por nome.
--    Sem perfil = modo compatível: só vale o que a pessoa marcar
--    explicitamente em cada publicação, e nunca uma Página vinculada a OUTRA
--    conta Instagram dela.
create table if not exists social_destination_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  instagram_account_id uuid not null references instagram_accounts (id) on delete cascade,
  -- Nome livre da categoria (só exibição — nunca usado para decidir destino).
  label text,
  -- false = esta conta NUNCA publica no Facebook (nem manual, nem automação, nem fila).
  facebook_enabled boolean not null default false,
  -- facebook_pages.id permitidos para publicações desta conta.
  allowed_facebook_page_refs uuid[] not null default '{}',
  -- Sugestão inicial (editável) na tela de criação. Sempre ⊆ permitidas.
  default_facebook_page_refs uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_destination_profiles_account_unique unique (user_id, instagram_account_id),
  constraint social_destination_profiles_defaults_subset check (default_facebook_page_refs <@ allowed_facebook_page_refs)
);

create index if not exists social_destination_profiles_user_idx on social_destination_profiles (user_id);

-- 2) Origem da escolha de cada destino Facebook.
--    manual                 = marcado pela pessoa na publicação;
--    automation             = lista explícita de Páginas da automação;
--    video_queue            = lista explícita de Páginas da fila;
--    legacy                 = criado antes desta migração (manual/fila);
--    automation_auto_legacy = criado pelo antigo modo "Automático" (sem escolha explícita).
alter table social_publication_destinations
  add column if not exists selection_source text not null default 'legacy';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'social_publication_destinations_selection_source_check') then
    alter table social_publication_destinations
      add constraint social_publication_destinations_selection_source_check
      check (selection_source in ('manual', 'automation', 'video_queue', 'legacy', 'automation_auto_legacy'));
  end if;
end $$;

-- Classificação dos destinos existentes (somente metadado; status intacto).
update social_publication_destinations d
set selection_source = case
    when a.facebook_page_ids is not null and d.facebook_page_ref = any (a.facebook_page_ids) then 'automation'
    else 'automation_auto_legacy'
  end
from automation_runs r
join content_automations a on a.id = r.automation_id
where (
    r.publication_id = d.post_id
    or r.id = (select p.automation_run_id from instagram_posts p where p.id = d.post_id)
  )
  and d.selection_source = 'legacy';

update social_publication_destinations d
set selection_source = 'video_queue'
from video_queue_items i
join video_queues q on q.id = i.queue_id
where i.post_id = d.post_id
  and d.selection_source = 'legacy'
  and d.facebook_page_ref = any (q.facebook_page_ids);

-- 3) Auditoria: cada tentativa registra a execução e o destino exato
--    (ids internos e o id da Página na Meta — nunca tokens).
alter table social_publication_attempts add column if not exists execution_id text;
alter table social_publication_attempts add column if not exists instagram_account_id uuid;
alter table social_publication_attempts add column if not exists facebook_page_ref uuid;
alter table social_publication_attempts add column if not exists external_account_id text;
alter table social_publication_attempts add column if not exists selection_source text;
-- false = bloqueado ANTES de chamar a Meta (nenhuma requisição saiu).
alter table social_publication_attempts add column if not exists api_called boolean;

alter table social_publication_attempts drop constraint if exists social_publication_attempts_outcome_check;
alter table social_publication_attempts
  add constraint social_publication_attempts_outcome_check
  check (outcome in ('success', 'failure', 'pending', 'reconciled', 'blocked'));
