-- Piloto Automático: modo "Prompt único recorrente" (SHARED_PROMPT).
--
-- Migração ADITIVA. Nada que já existe é alterado, apagado ou migrado:
-- toda automação atual fica com schedule_mode = 'CUSTOM' (o modelo de
-- sempre: cada dia/horário em content_automation_days tem o SEU prompt).
--
-- Decisão de arquitetura: content_automation_days continua sendo a tabela
-- de OCORRÊNCIAS (uma linha por dia + horário). O cron, a chave de
-- idempotência (automation_runs UNIQUE (automation_day_id, run_date)) e o
-- histórico dependem dela e NÃO mudam. No modo SHARED_PROMPT:
--   * o conteúdo (prompt, tipo, modo IA/manual, template, mídias…) é
--     guardado UMA vez na própria automação, nas colunas shared_* abaixo;
--   * as linhas de dia/horário guardam só quando executar
--     (day_of_week, slot_index, publish_time, enabled);
--   * na hora de gerar, o cron sobrepõe o conteúdo compartilhado à linha
--     (ver lib/content-automation/shared-schedule.ts) — editar o prompt é
--     um único UPDATE e vale para todas as execuções futuras.
-- Horários removidos são DESABILITADOS (enabled = false), nunca apagados:
-- automation_runs referencia a linha com ON DELETE CASCADE e apagá-la
-- apagaria o histórico das execuções dela.

alter table content_automations
  add column if not exists schedule_mode text not null default 'CUSTOM'
    check (schedule_mode in ('CUSTOM', 'SHARED_PROMPT'));

alter table content_automations
  add column if not exists shared_content_type text not null default 'POST'
    check (shared_content_type in ('POST', 'REEL', 'CAROUSEL', 'STORY'));

alter table content_automations
  add column if not exists shared_content_mode text not null default 'AI'
    check (shared_content_mode in ('AI', 'MANUAL'));

alter table content_automations
  add column if not exists shared_content_category text
    check (shared_content_category is null or shared_content_category in (
      'MOTIVACIONAL', 'FINANCEIRO', 'UTILIDADES', 'CURIOSIDADE', 'DIVULGACAO', 'PERSONALIZADO'
    ));

alter table content_automations add column if not exists shared_prompt text not null default '';
alter table content_automations add column if not exists shared_manual_caption text;
alter table content_automations add column if not exists shared_visual_text text;
alter table content_automations add column if not exists shared_template_id text;
alter table content_automations add column if not exists shared_style_config jsonb;

alter table content_automations
  add column if not exists shared_overlay_opacity real
    check (shared_overlay_opacity is null or (shared_overlay_opacity >= 0 and shared_overlay_opacity <= 1));

alter table content_automations
  add column if not exists shared_visual_text_color text
    check (shared_visual_text_color is null or shared_visual_text_color ~ '^#[0-9a-fA-F]{6}$');

alter table content_automations
  add column if not exists shared_image_media_id uuid references instagram_media (id) on delete set null;

alter table content_automations
  add column if not exists shared_video_media_id uuid references instagram_media (id) on delete set null;
