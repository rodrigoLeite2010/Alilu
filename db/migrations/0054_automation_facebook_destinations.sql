-- Piloto Automático → também publicar nas Páginas do Facebook.
--
-- Causa do problema corrigido: o Piloto Automático criava as publicações
-- (instagram_posts) SEM nenhuma linha em social_publication_destinations,
-- então o agendador (/api/cron/instagram-publish → runFacebookScheduler)
-- não tinha nenhum destino Facebook para publicar — só o Instagram saía.
--
-- Migração ADITIVA (nenhum dado existente muda):
--   * facebook_page_ids NULL  = automático: Páginas do Facebook CONECTADAS
--     e vinculadas à MESMA conta Instagram da automação
--     (facebook_pages.instagram_account_id);
--   * facebook_page_ids '{}'  = não publicar no Facebook;
--   * facebook_page_ids [ids] = exatamente essas Páginas (facebook_pages.id).
-- O destino Facebook é gravado só quando o Piloto CRIA uma nova publicação:
-- publicações já existentes/agendadas não ganham Facebook retroativamente.
alter table content_automations
  add column if not exists facebook_page_ids uuid[];
