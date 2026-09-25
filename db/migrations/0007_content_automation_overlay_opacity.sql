-- Piloto Automático de Conteúdo: véu (overlay) configurável sobre a foto
-- de fundo no modo AUTO_TEMPLATE (correção do bug "imagem escura", que
-- antes usava um degradê fixo de até 74% de preto, sem nenhum controle).
--
-- Migração ADITIVA (mesmo padrão de 0003/0004/0005/0006): coluna nova,
-- nullable — NULL preserva o comportamento de hoje (o degradê fixo do
-- template, se ele tiver um; nenhuma automação existente muda de
-- aparência). Guardada como fração (0 a 1) para bater exatamente com
-- BackgroundImageState.overlayOpacity (lib/instagram/editor-state.ts) e
-- com o que render.ts desenha — nunca precisa converter porcentagem.

alter table content_automation_days
  add column if not exists overlay_opacity real
    check (overlay_opacity is null or (overlay_opacity >= 0 and overlay_opacity <= 1));
