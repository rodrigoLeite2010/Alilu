/**
 * Catálogo do módulo "Posts Virais".
 *
 * Um Post Viral é uma arte criada a partir de um template do editor
 * (lib/instagram/templates.ts) com textos e formato já pensados para
 * engajamento. O catálogo é EXTENSÍVEL: para criar um template novo basta
 * acrescentar uma entrada aqui (sem mexer no editor nem na publicação).
 * Não há geração automática/IA nesta etapa — só templates prontos.
 *
 * Camadas de cada template (ordem de desenho em lib/instagram/render.ts):
 *   1. background — cor de fundo (ou a foto do usuário em tela cheia,
 *      quando o template não tem área de foto)
 *   2. image      — a foto do usuário, recortada em "cover" com
 *      enquadramento e zoom (nunca distorcida)
 *   3. overlay    — degradê/decoração que mantém o texto legível
 *   4. badge      — selo curto ("50% OFF")
 *   5. title      — título (slot "heading")
 *   6. subtitle   — texto de apoio (slot "body")
 *   7. CTA/logo   — rodapé (slot "footer": chamada ou nome da marca)
 * Trocar a imagem só altera a camada 2 — o resto do template fica intacto.
 */

import { createInitialEditorState, updateTextValue, type PostEditorState } from "@/lib/instagram/editor-state";
import type { PostFormatId } from "@/lib/instagram/formats";
import type { PostTemplateId, TextSlotId } from "@/lib/instagram/templates";

export const TEMPLATE_LAYER_ORDER = [
  "background",
  "image",
  "overlay",
  "badge",
  "title",
  "subtitle",
  "cta",
] as const;

export interface ViralTemplate {
  id: string;
  name: string;
  description: string;
  /** Template do editor usado como base (layout, camadas, área da foto). */
  baseTemplateId: PostTemplateId;
  /** Formato padrão — 4:5 (1080 × 1350) ocupa mais espaço no feed. */
  formatId: PostFormatId;
  /** Textos iniciais sugeridos por camada. */
  texts: Partial<Record<TextSlotId, string>>;
  /** Pede uma foto do usuário (mostra o convite "Adicionar minha imagem"). */
  wantsPhoto: boolean;
}

export const VIRAL_TEMPLATES: ViralTemplate[] = [
  {
    id: "oferta-relampago",
    name: "Oferta relâmpago",
    description: "Foto do produto em destaque, selo de desconto e chamada para comprar.",
    baseTemplateId: "promocao",
    formatId: "vertical",
    texts: { badge: "SÓ HOJE", heading: "Oferta relâmpago", body: "Aproveite antes que acabe!", footer: "Chame no direct" },
    wantsPhoto: true,
  },
  {
    id: "produto-do-dia",
    name: "Produto do dia",
    description: "Ideal para restaurantes e lojas: foto grande, nome e preço.",
    baseTemplateId: "restaurante",
    formatId: "vertical",
    texts: { badge: "R$ 29,90", heading: "Produto do dia", body: "Feito na hora, do jeito que você gosta.", footer: "Peça pelo link da bio" },
    wantsPhoto: true,
  },
  {
    id: "frase-que-engaja",
    name: "Frase que engaja",
    description: "Frase de impacto sobre a sua foto em tela cheia — ótima para salvar e compartilhar.",
    baseTemplateId: "frase-motivacional",
    formatId: "vertical",
    texts: { heading: "Feito é melhor que perfeito.", body: "Salve para lembrar amanhã.", footer: "@seuperfil" },
    wantsPhoto: true,
  },
  {
    id: "aviso-importante",
    name: "Aviso importante",
    description: "Comunicado claro e direto para seus seguidores.",
    baseTemplateId: "comunicado",
    formatId: "vertical",
    texts: { badge: "AVISO", heading: "Novidade por aqui!", body: "Conte em poucas palavras o que mudou.", footer: "Sua marca" },
    wantsPhoto: false,
  },
  {
    id: "comemoracao",
    name: "Comemoração",
    description: "Aniversários, datas especiais e conquistas, com foto em destaque.",
    baseTemplateId: "aniversario",
    formatId: "vertical",
    texts: { heading: "Hoje é dia de festa!", body: "Obrigado por fazer parte dessa história.", footer: "Sua marca" },
    wantsPhoto: true,
  },
];

export function getViralTemplateById(id: string | null | undefined): ViralTemplate | undefined {
  return VIRAL_TEMPLATES.find((template) => template.id === id);
}


/** Estado inicial do editor para um Post Viral (template base + textos sugeridos + formato). */
export function createViralInitialState(template: ViralTemplate): PostEditorState {
  let state = createInitialEditorState(template.baseTemplateId, template.formatId);
  for (const [slotId, value] of Object.entries(template.texts) as Array<[TextSlotId, string]>) {
    state = updateTextValue(state, slotId, value);
  }
  return state;
}
