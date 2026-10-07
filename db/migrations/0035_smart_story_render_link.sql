-- SmartStoryEngine (Fase 4): vínculo do Story com a mídia renderizada e o
-- fundo usado. Migração ADITIVA (if not exists).
--
-- image_media_id: a linha de instagram_media da arte. Com ela, um retry
-- (falha depois do render, cron duplicado) reaproveita A MESMA arte em vez
-- de renderizar/subir outra, e a publicação do mesmo horário nunca cria um
-- segundo post (o post é localizado por esta mídia).
-- background_id: id do fundo (biblioteca) — evita repetir o mesmo fundo em
-- Stories seguidos.

alter table smart_story_generations
  add column if not exists image_media_id uuid references instagram_media (id) on delete set null;

alter table smart_story_generations
  add column if not exists background_id text;

create index if not exists smart_story_generations_post_idx
  on smart_story_generations (instagram_post_id);
