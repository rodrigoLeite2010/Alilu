-- Piloto Automático de Conteúdo: modo manual por dia (sem IA).
--
-- Migração ADITIVA (mesma convenção de 0003/0004): só acrescenta colunas
-- novas em content_automation_days, com default que preserva o
-- comportamento de hoje (todo dia já existente continua em 'AI', gerando
-- a legenda com IA a partir do prompt, exatamente como antes).
--
-- content_mode = 'MANUAL': o dia publica a legenda escrita em
-- manual_caption tal como está — o cron (content-automation-cron.ts)
-- nunca chama o provedor de IA para esse dia. Isso também significa que
-- uma automação com todos os dias em modo MANUAL não exige mais
-- CONTENT_AI_API_KEY configurada (ver docs/content-automation.md).

alter table content_automation_days
  add column if not exists content_mode text not null default 'AI'
    check (content_mode in ('AI', 'MANUAL'));

alter table content_automation_days
  add column if not exists manual_caption text;
