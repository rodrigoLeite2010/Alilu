import "server-only";
import { getDb } from "@/lib/db/client";
import { normalizePhotoQuery, type PhotoProvider, type StockPhoto } from "./photo-provider";

export const PHOTO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isStockPhoto(value: unknown): value is StockPhoto {
  if (!value || typeof value !== "object") return false;
  const photo = value as Record<string, unknown>;
  return typeof photo.id === "string" && typeof photo.url === "string" && typeof photo.provider === "string";
}

/**
 * Cache de buscas do banco de fotos (provedor + consulta). Evita pagar/estourar o limite de requisições do
 * provedor e deixa a escolha estável. Qualquer falha do cache (ex.: tabela ainda não migrada) é ignorada:
 * a busca segue direto no provedor.
 */
export function cachedPhotoProvider(base: PhotoProvider, ttlMs: number = PHOTO_CACHE_TTL_MS): PhotoProvider {
  return {
    id: base.id,
    async search(query, options) {
      const key = normalizePhotoQuery(query).toLowerCase();
      const limit = options?.limit ?? 8;
      if (!key) return [];
      try {
        const rows = await getDb()`
          select results from carousel_photo_search_cache
          where provider = ${base.id} and query = ${key} and created_at > ${new Date(Date.now() - ttlMs).toISOString()}::timestamptz
        `;
        const stored = rows[0]?.results;
        const list = (typeof stored === "string" ? JSON.parse(stored) : stored) as unknown;
        if (Array.isArray(list) && list.length >= Math.min(limit, 5) && list.every(isStockPhoto)) return (list as StockPhoto[]).slice(0, limit);
      } catch {
        /* sem cache: busca direto */
      }
      const found = await base.search(query, options);
      if (found.length > 0) {
        try {
          await getDb()`
            insert into carousel_photo_search_cache (provider, query, results, created_at)
            values (${base.id}, ${key}, ${JSON.stringify(found)}::jsonb, now())
            on conflict (provider, query) do update set results = excluded.results, created_at = now()
          `;
        } catch {
          /* ignora */
        }
      }
      return found;
    },
  };
}
