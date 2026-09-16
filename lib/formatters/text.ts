/**
 * Utilitários de formatação de texto usados em toda a plataforma
 * (ex.: geração de slugs para busca e comparação de ferramentas).
 */

/**
 * Converte um texto livre em um slug de URL (minúsculo, sem acentos,
 * separado por hífens). Não é usado para redefinir slugs já existentes no
 * catálogo (data/tools.ts), apenas para busca e comparação de texto.
 */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Normaliza um texto para comparação de busca: minúsculo e sem acentos.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
