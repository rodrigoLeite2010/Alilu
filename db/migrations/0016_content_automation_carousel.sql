-- Piloto Automático de Conteúdo: modo "CAROUSEL" (texto comprido dividido
-- em vários slides, mesmo motor de divisão do Carrossel automático manual
-- — lib/instagram/carousel/generate-slides-from-text.ts — reaproveitado
-- server-side) e cor do texto desenhado sobre a imagem, escolhida pelo
-- usuário (antes sempre branco, com uma faixa preta fixa atrás — removida
-- junto desta mudança em template-render-service.ts).
--
-- Migração ADITIVA (mesmo padrão de 0005/0006/0007): amplia o CHECK de
-- content_type (precisa dropar e recriar — é inline desde 0004, mesma
-- técnica já usada em 0004 para instagram_posts_source_check) e adiciona
-- 1 coluna nullable — NULL preserva o comportamento de hoje (texto
-- branco) para toda automação já existente; nenhuma automação existente
-- usa CAROUSEL ainda, então o CHECK ampliado não afeta nenhuma linha.

alter table content_automation_days
  drop constraint if exists content_automation_days_content_type_check;

alter table content_automation_days
  add constraint content_automation_days_content_type_check
    check (content_type in ('POST', 'REEL', 'CAROUSEL'));

alter table content_automation_days
  add column if not exists visual_text_color text
    check (visual_text_color is null or visual_text_color ~ '^#[0-9a-fA-F]{6}$');
