-- Importar carrossel do Instagram (todas as fotos/vídeos) + repostar como
-- carrossel. ADITIVA.

-- Itens já guardados no Blob do Alilu, na ordem do carrossel:
-- [{ index, mediaType, fileUrl, storagePath, contentType, fileSizeBytes,
--    durationSeconds, width, height, hasAudio }]. imported_file_url continua
-- sendo o 1º item (compatibilidade com o resto do sistema).
alter table instagram_media_imports add column if not exists imported_items jsonb not null default '[]'::jsonb;

-- Carrossel com vídeo: os containers-filho de vídeo processam de forma
-- assíncrona na Meta. Guardamos os ids para retomar no próximo ciclo sem
-- recriar (e sem gastar o limite de publicação).
alter table instagram_posts add column if not exists meta_children_ids text[];
