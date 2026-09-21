/**
 * Tipos do Gerador de Legendas (Fase 2, ETAPA 8/9/10). Funciona 100% no
 * navegador, sem nenhuma API de IA paga (nem gratuita) — a "geração" é a
 * combinação de modelos de texto prontos (editáveis) com os dados que o
 * próprio usuário informa no formulário. Nunca promete geração por IA.
 */

export type CaptionContentTypeId =
  | "promocao"
  | "produto"
  | "restaurante"
  | "aniversario"
  | "agradecimento"
  | "conteudo-educativo"
  | "dicas"
  | "comunicado"
  | "motivacional"
  | "pessoal";

export interface CaptionContentType {
  id: CaptionContentTypeId;
  name: string;
}

export const CAPTION_CONTENT_TYPES: CaptionContentType[] = [
  { id: "promocao", name: "Promoção" },
  { id: "produto", name: "Produto" },
  { id: "restaurante", name: "Restaurante" },
  { id: "aniversario", name: "Aniversário" },
  { id: "agradecimento", name: "Agradecimento" },
  { id: "conteudo-educativo", name: "Conteúdo educativo" },
  { id: "dicas", name: "Dicas" },
  { id: "comunicado", name: "Comunicado" },
  { id: "motivacional", name: "Motivacional" },
  { id: "pessoal", name: "Publicação pessoal" },
];

export type CaptionStyleId = "profissional" | "descontraido" | "comercial" | "inspirador" | "informativo";

export interface CaptionStyleOption {
  id: CaptionStyleId;
  name: string;
}

export const CAPTION_STYLES: CaptionStyleOption[] = [
  { id: "profissional", name: "Profissional" },
  { id: "descontraido", name: "Descontraído" },
  { id: "comercial", name: "Comercial" },
  { id: "inspirador", name: "Inspirador" },
  { id: "informativo", name: "Informativo" },
];

export type CaptionSizeId = "curto" | "medio" | "longo";

export interface CaptionSizeOption {
  id: CaptionSizeId;
  name: string;
}

export const CAPTION_SIZES: CaptionSizeOption[] = [
  { id: "curto", name: "Curto" },
  { id: "medio", name: "Médio" },
  { id: "longo", name: "Longo" },
];

export const DEFAULT_CONTENT_TYPE_ID: CaptionContentTypeId = "promocao";
export const DEFAULT_STYLE_ID: CaptionStyleId = "profissional";
export const DEFAULT_SIZE_ID: CaptionSizeId = "medio";

export interface CaptionFormInput {
  /** Assunto do post — o único dado que o usuário precisa informar de fato. */
  subject: string;
  contentType: CaptionContentTypeId;
  /** Público-alvo (opcional, ETAPA 8). */
  audience: string;
  style: CaptionStyleId;
  size: CaptionSizeId;
  /** Chamada para ação (opcional, texto livre do próprio usuário — nunca inventada, ETAPA 9). */
  callToAction: string;
  includeEmojis: boolean;
  includeHashtags: boolean;
}

export function createDefaultCaptionFormInput(): CaptionFormInput {
  return {
    subject: "",
    contentType: DEFAULT_CONTENT_TYPE_ID,
    audience: "",
    style: DEFAULT_STYLE_ID,
    size: DEFAULT_SIZE_ID,
    callToAction: "",
    includeEmojis: true,
    includeHashtags: true,
  };
}

export interface GeneratedCaption {
  id: string;
  text: string;
  hashtags: string[];
}

export function getContentTypeById(id: string): CaptionContentType | undefined {
  return CAPTION_CONTENT_TYPES.find((item) => item.id === id);
}

export function getStyleById(id: string): CaptionStyleOption | undefined {
  return CAPTION_STYLES.find((item) => item.id === id);
}

export function getSizeById(id: string): CaptionSizeOption | undefined {
  return CAPTION_SIZES.find((item) => item.id === id);
}
