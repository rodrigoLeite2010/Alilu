-- Piloto Automático × Carrossel Inteligente (Fase 3).
-- Migração ADITIVA e idempotente: automações atuais não mudam.

alter table content_automation_days drop constraint if exists content_automation_days_content_type_check;
alter table content_automation_days
  add constraint content_automation_days_content_type_check
    check (content_type in ('POST', 'REEL', 'CAROUSEL', 'STORY', 'SMART_CAROUSEL'));

alter table content_automations drop constraint if exists content_automations_shared_content_type_check;
alter table content_automations
  add constraint content_automations_shared_content_type_check
    check (shared_content_type in ('POST', 'REEL', 'CAROUSEL', 'STORY', 'SMART_CAROUSEL'));

-- Configuração do Carrossel Inteligente automático (template, imagens, nº de slides…).
alter table content_automations
  add column if not exists smart_carousel_config jsonb not null default '{}'::jsonb;

-- Vínculo execução ↔ projeto. UNIQUE = idempotência: no máximo UM projeto por execução
-- (automação + horário); retry da execução reaproveita este projeto, nunca cria outro.
alter table carousel_projects
  add column if not exists automation_id uuid references content_automations (id) on delete set null;
alter table carousel_projects
  add column if not exists automation_run_id uuid references automation_runs (id) on delete set null;
alter table carousel_projects
  add column if not exists scheduled_for timestamptz;

create unique index if not exists carousel_projects_automation_run_uidx
  on carousel_projects (automation_run_id) where automation_run_id is not null;
create index if not exists carousel_projects_automation_idx
  on carousel_projects (automation_id, created_at desc) where automation_id is not null;

alter table carousel_projects drop constraint if exists carousel_projects_source_kind_check;
alter table carousel_projects
  add constraint carousel_projects_source_kind_check
    check (source_kind in ('TOPIC', 'SUGGESTED', 'TREND', 'URL', 'PROFILE', 'AUTOMATION'));
