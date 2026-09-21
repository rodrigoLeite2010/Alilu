/**
 * Formatos de imagem suportados pelo Criador de Posts para Instagram
 * (ETAPA 3 do prompt de implementação). A resolução exportada é sempre a
 * resolução real do formato escolhido, independente do tamanho da tela do
 * usuário — a prévia usa exatamente estas mesmas dimensões como base de
 * proporção (ver lib/instagram/render.ts).
 */

export type PostFormatId = "quadrado" | "vertical" | "stories";

export interface PostFormat {
  id: PostFormatId;
  label: string;
  shortLabel: string;
  width: number;
  height: number;
  description: string;
}

export const POST_FORMATS: PostFormat[] = [
  {
    id: "quadrado",
    label: "Post quadrado (1080 × 1080)",
    shortLabel: "Quadrado",
    width: 1080,
    height: 1080,
    description: "Proporção 1:1 — ideal para o feed do Instagram.",
  },
  {
    id: "vertical",
    label: "Post vertical (1080 × 1350)",
    shortLabel: "Vertical",
    width: 1080,
    height: 1350,
    description: "Proporção 4:5 — ocupa mais espaço na tela do feed.",
  },
  {
    id: "stories",
    label: "Stories / Reels (1080 × 1920)",
    shortLabel: "Stories",
    width: 1080,
    height: 1920,
    description: "Proporção 9:16 — tela cheia para Stories e Reels.",
  },
];

export const DEFAULT_FORMAT_ID: PostFormatId = "quadrado";

export function getFormatById(id: string): PostFormat {
  return POST_FORMATS.find((format) => format.id === id) ?? POST_FORMATS[0];
}

export function isPostFormatId(value: string): value is PostFormatId {
  return POST_FORMATS.some((format) => format.id === value);
}
