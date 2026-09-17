/**
 * Remoção de acentos de um texto — ferramenta "Remover Acentos de Texto"
 * (categoria Funções String). Usa a mesma técnica de normalização Unicode
 * (NFD + remoção de marcas diacríticas) já usada em `slugify`/
 * `normalizeForSearch` (lib/formatters/text.ts) — aqui como uma função à
 * parte porque, ao contrário daquelas, esta preserva a caixa original do
 * texto (não deve ficar tudo minúsculo).
 */
export function removeAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
