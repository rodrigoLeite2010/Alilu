-- Piloto Automático de Conteúdo: modo AUTO_TEMPLATE (IA/manual gera o
-- texto, o servidor desenha o texto sobre a imagem escolhida).
--
-- Migração ADITIVA (mesma convenção de 0003/0004/0005): só acrescenta
-- colunas novas, todas nullable ou com default que preserva o
-- comportamento de hoje — nenhuma automação existente muda de
-- comportamento até o usuário escolher explicitamente o modo de imagem
-- "Gerar com IA sobre a imagem" no assistente.
--
-- visual_text: a frase curta desenhada sobre a imagem quando o dia usa
-- content_mode = 'MANUAL' (o usuário escreve ele mesmo, mesmo padrão de
-- manual_caption da migração 0005, mas para o texto que vai NA imagem,
-- não a legenda do Instagram). Em content_mode = 'AI', o texto visual é
-- gerado pela IA a cada execução e nunca é persistido aqui (day continua
-- sendo o "molde" reaproveitado toda semana, não uma instância).
--
-- generated_from_media_id / automation_run_id em instagram_media: só
-- rastreabilidade (qual foto de origem e qual execução geraram esta
-- imagem composta) — nunca bloqueiam nada existente, media sem esses
-- campos preenchidos (upload manual do usuário) continua funcionando
-- exatamente como antes.

alter table content_automation_days
  add column if not exists visual_text text;

alter table instagram_media
  add column if not exists generated_from_media_id uuid references instagram_media (id) on delete set null;

alter table instagram_media
  add column if not exists automation_run_id uuid references automation_runs (id) on delete set null;
