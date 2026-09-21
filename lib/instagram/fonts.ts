/**
 * Fontes disponíveis no editor. Todas são fontes de sistema amplamente
 * disponíveis em Windows, macOS, Android, iOS e Linux com fontconfig — não
 * dependem de carregamento de arquivo externo (@font-face). Isso evita que
 * a prévia ou a exportação usem uma fonte diferente da esperada por causa
 * de uma fonte que ainda não terminou de carregar (ETAPA 6, requisito 3),
 * já que fontes de sistema ficam disponíveis assim que a página existe.
 * Mesmo assim, a exportação (lib/instagram/export.ts) aguarda
 * `document.fonts.ready` como camada extra de segurança.
 */

export interface PostFontOption {
  id: string;
  label: string;
  /** Valor pronto para uso em ctx.font / CSS font-family. */
  family: string;
}

export const POST_FONTS: PostFontOption[] = [
  { id: "sans-ui", label: "Sem serifa moderna (Segoe UI)", family: "'Segoe UI', Roboto, system-ui, sans-serif" },
  { id: "sans", label: "Sem serifa clássica (Helvetica)", family: "Helvetica, Arial, sans-serif" },
  { id: "serif", label: "Serifada elegante (Georgia)", family: "Georgia, 'Times New Roman', serif" },
  { id: "serif-classic", label: "Serifada clássica (Times New Roman)", family: "'Times New Roman', Georgia, serif" },
  { id: "display", label: "Destaque para títulos (Impact)", family: "Impact, 'Arial Black', sans-serif" },
  { id: "mono", label: "Monoespaçada (Courier New)", family: "'Courier New', monospace" },
];

export const DEFAULT_FONT_ID = "sans-ui";

export function getFontById(id: string): PostFontOption {
  return POST_FONTS.find((font) => font.id === id) ?? POST_FONTS[0];
}

export function isPostFontId(value: string): boolean {
  return POST_FONTS.some((font) => font.id === value);
}
