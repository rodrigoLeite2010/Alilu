/**
 * Os cinco modelos de carrossel da ETAPA 7. Cada modelo é só um "plano de
 * slides": qual dos cinco templates do Criador de Posts usar em cada
 * posição e, opcionalmente, um texto inicial diferente do padrão do
 * template — não é um sistema de desenho paralelo, é só uma receita que
 * gera uma sequência de `CarouselSlide` reaproveitando 100% do motor de
 * templates/render já existente (nenhum elemento gráfico novo é
 * desenhado). Aparência original: nenhuma composição de cores, textos ou
 * ícones aqui reproduz um template de concorrente.
 *
 * Os textos de exemplo são frases genéricas e editáveis (igual ao valor
 * padrão de qualquer template, ex.: "Mega Promoção") — de propósito, sem
 * nenhuma sintaxe de "variável" com chaves (ex.: "{assunto}") visível para
 * quem usa a ferramenta, para não parecer um campo quebrado antes de ser
 * editado. Também evitam prometer uma quantidade específica de itens (ex.:
 * "5 dicas") quando o modelo só tem 3 slides de conteúdo — ver ETAPA 9.
 */

import { updateTextValue } from "../editor-state";
import { getTemplateById, type PostTemplateId, type TextSlotId } from "../templates";
import { createCarouselSlide, type CarouselFormatId, type CarouselSlide } from "./carousel-state";

type SlidePlanEntry = {
  templateId: PostTemplateId;
  texts?: Partial<Record<TextSlotId, string>>;
};

export interface CarouselPreset {
  id: string;
  name: string;
  description: string;
  slidePlan: SlidePlanEntry[];
}

export const CAROUSEL_PRESETS: CarouselPreset[] = [
  {
    id: "educativo",
    name: "Educativo",
    description: "Capa com pergunta ou tema, slides de conteúdo e um encerramento com chamada para ação.",
    slidePlan: [
      {
        templateId: "comunicado",
        texts: { badge: "Educativo", heading: "Você sabia disso sobre este assunto?", body: "" },
      },
      { templateId: "comunicado", texts: { badge: "Ponto 1", heading: "Primeiro ponto importante", body: "Explique aqui a primeira informação." } },
      { templateId: "comunicado", texts: { badge: "Ponto 2", heading: "Segundo ponto importante", body: "Explique aqui a segunda informação." } },
      { templateId: "comunicado", texts: { badge: "Ponto 3", heading: "Terceiro ponto importante", body: "Explique aqui a terceira informação." } },
      { templateId: "comunicado", texts: { badge: "Para lembrar", heading: "Gostou? Salve esse post", body: "Compartilhe com quem também precisa saber disso." } },
    ],
  },
  {
    id: "dicas",
    name: "Dicas",
    description: "Capa, uma dica por slide e uma página final com o resumo de tudo.",
    slidePlan: [
      { templateId: "comunicado", texts: { badge: "Dicas", heading: "Dicas rápidas sobre este assunto", body: "" } },
      { templateId: "comunicado", texts: { badge: "Dica 1", heading: "Primeira dica", body: "" } },
      { templateId: "comunicado", texts: { badge: "Dica 2", heading: "Segunda dica", body: "" } },
      { templateId: "comunicado", texts: { badge: "Dica 3", heading: "Terceira dica", body: "" } },
      { templateId: "comunicado", texts: { badge: "Resumo", heading: "Recapitulando", body: "Guarde essas dicas para consultar depois." } },
    ],
  },
  {
    id: "produtos",
    name: "Produtos",
    description: "Capa promocional, um produto por slide e um encerramento comercial com chamada para ação.",
    slidePlan: [
      { templateId: "promocao", texts: { badge: "Novidades" } },
      { templateId: "restaurante", texts: { heading: "Nome do produto 1", body: "Descreva aqui o diferencial deste produto." } },
      { templateId: "restaurante", texts: { heading: "Nome do produto 2", body: "Descreva aqui o diferencial deste produto." } },
      { templateId: "restaurante", texts: { heading: "Nome do produto 3", body: "Descreva aqui o diferencial deste produto." } },
      { templateId: "promocao", texts: { heading: "Confira a coleção completa", body: "Fale com a gente e garanta o seu." } },
    ],
  },
  {
    id: "passo-a-passo",
    name: "Passo a passo",
    description: "Capa, etapas numeradas e uma conclusão.",
    slidePlan: [
      { templateId: "comunicado", texts: { badge: "Passo a passo", heading: "Como fazer, passo a passo", body: "" } },
      { templateId: "comunicado", texts: { badge: "Etapa 1", heading: "Primeira etapa", body: "" } },
      { templateId: "comunicado", texts: { badge: "Etapa 2", heading: "Segunda etapa", body: "" } },
      { templateId: "comunicado", texts: { badge: "Etapa 3", heading: "Terceira etapa", body: "" } },
      { templateId: "comunicado", texts: { badge: "Pronto!", heading: "Conclusão", body: "Agora é só aplicar o que você aprendeu." } },
    ],
  },
  {
    id: "frases",
    name: "Frases",
    description: "Capa e frases independentes, uma por slide, com um encerramento de fechamento.",
    slidePlan: [
      { templateId: "frase-motivacional", texts: { heading: "Frase de abertura." } },
      { templateId: "frase-motivacional", texts: { heading: "Segunda frase." } },
      { templateId: "frase-motivacional", texts: { heading: "Terceira frase." } },
      { templateId: "frase-motivacional", texts: { heading: "Quarta frase." } },
      { templateId: "frase-motivacional", texts: { heading: "Siga para mais frases assim.", footer: "@sua_marca" } },
    ],
  },
];

export function getCarouselPresetById(id: string): CarouselPreset | undefined {
  return CAROUSEL_PRESETS.find((preset) => preset.id === id);
}

/**
 * Gera os slides iniciais de um modelo de carrossel (ETAPA 7), aplicando os
 * textos de exemplo de cada posição por cima do template escolhido via as
 * mesmas funções puras do editor de posts (`updateTextValue`) — garante
 * que um slot vazio nunca fique com pontuação quebrada, porque continua
 * passando pelas mesmas regras de "slot vazio não é desenhado".
 */
export function buildSlidesFromPreset(preset: CarouselPreset, formatId: CarouselFormatId): CarouselSlide[] {
  return preset.slidePlan.map((entry) => {
    const slide = createCarouselSlide(formatId, entry.templateId);
    if (!entry.texts) return slide;

    let nextState = slide.state;
    for (const [slotId, value] of Object.entries(entry.texts) as [TextSlotId, string][]) {
      nextState = updateTextValue(nextState, slotId, value);
    }
    return { ...slide, state: nextState };
  });
}

/** Confirma, para os testes de integridade, que todo template referenciado pelos modelos realmente existe. */
export function assertPresetTemplatesExist(): void {
  for (const preset of CAROUSEL_PRESETS) {
    for (const entry of preset.slidePlan) {
      getTemplateById(entry.templateId);
    }
  }
}
