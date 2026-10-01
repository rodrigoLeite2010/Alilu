-- Piloto Automático: STORIES do Instagram + vários horários no mesmo dia.
--
-- Decisão de arquitetura: NÃO existe um "piloto de Stories" separado. O
-- mesmo motor (content_automations / content_automation_days /
-- automation_runs / cron de geração / agendador de publicação) passa a
-- aceitar mais um tipo de mídia (STORY) e mais de um horário por dia —
-- um único cron, uma única camada de publicação, um único histórico.
--
-- Migração ADITIVA e compatível com tudo que já existe:
--   1. instagram_posts.post_type ganha 'story' (CHECK inline desde 0001 —
--      drop + recria, mesma técnica de 0016).
--   2. content_automation_days.content_type ganha 'STORY'.
--   3. content_automation_days ganha slot_index (0 = horário principal do
--      dia, o único que existia até aqui; 1, 2, … = horários extras
--      adicionados pelo usuário) e content_category (Motivacional,
--      Financeiro… — opcional, só alimenta a variável {{categoria}} do
--      prompt e a sugestão de prompt na tela). Toda linha existente fica
--      com slot_index = 0, então a unicidade antiga (automation_id,
--      day_of_week) continua valendo para os dados de hoje.
--   4. automation_runs: a trava de idempotência deixa de ser "1 execução
--      por automação por dia" e passa a ser "1 execução por HORÁRIO
--      (automation_day_id) por dia". Como até aqui cada automação tinha um
--      único horário por dia, nenhuma linha existente viola a nova regra.

alter table instagram_posts drop constraint if exists instagram_posts_post_type_check;
alter table instagram_posts
  add constraint instagram_posts_post_type_check
    check (post_type in ('image', 'carousel', 'reels', 'story'));

alter table content_automation_days drop constraint if exists content_automation_days_content_type_check;
alter table content_automation_days
  add constraint content_automation_days_content_type_check
    check (content_type in ('POST', 'REEL', 'CAROUSEL', 'STORY'));

alter table content_automation_days
  add column if not exists slot_index int not null default 0
    check (slot_index >= 0 and slot_index < 24);

alter table content_automation_days
  add column if not exists content_category text
    check (content_category is null or content_category in (
      'MOTIVACIONAL', 'FINANCEIRO', 'UTILIDADES', 'CURIOSIDADE', 'DIVULGACAO', 'PERSONALIZADO'
    ));

alter table content_automation_days drop constraint if exists content_automation_days_unique;
alter table content_automation_days drop constraint if exists content_automation_days_slot_unique;
alter table content_automation_days
  add constraint content_automation_days_slot_unique unique (automation_id, day_of_week, slot_index);

alter table automation_runs drop constraint if exists automation_runs_unique_per_day;
alter table automation_runs drop constraint if exists automation_runs_unique_per_slot_day;
alter table automation_runs
  add constraint automation_runs_unique_per_slot_day unique (automation_day_id, run_date);
