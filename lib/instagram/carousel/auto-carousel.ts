/**
 * Integração entre o "Carrossel automático" (colar um texto grande + uma
 * imagem e clicar em "Gerar carrossel") e o resto do editor de carrossel.
 *
 * `generate-slides-from-text.ts` e `text-fit.ts` são deliberadamente puros
 * (sem Canvas/DOM real, só a interface estrutural `TextMeasurer`) para
 * serem testáveis direto com Vitest — ver os arquivos de teste ao lado.
 * Este arquivo é a única ponte entre esse mundo puro e o resto do app de
 * verdade: resolve a caixa de texto real a partir do template "frase
 * motivacional" (templates.ts) e do formato escolhido (formats.ts) — a
 * MESMA conta que `render.ts` usa para desenhar de verdade, então o que
 * este arquivo decide que "cabe" sempre bate com o que aparece na tela —,
 * cria o `TextMeasurer` de verdade (um <canvas> fora da tela), e monta o
 * `CarouselEditorState` final via `createCarouselStateFromTextChunks`
 * (carousel-state.ts).
 */
import { createEmptyBackgroundImage, type BackgroundImageState } from "../editor-state";
import { getFontById } from "../fonts";
import { getFormatById } from "../formats";
import { getTemplateById } from "../templates";
import {
  createCarouselStateFromTextChunks,
  GENERATED_CAROUSEL_TEMPLATE_ID,
  GENERATED_CAROUSEL_TEXT_SLOT,
  MAX_CAROUSEL_SLIDES,
  type CarouselEditorState,
  type CarouselFormatId,
} from "./carousel-state";
import { generateSlidesFromText } from "./generate-slides-from-text";
import { resolveTextBlockBox, type TextBlockBox, type TextMeasurer } from "./text-fit";

/**
 * Resolve a caixa de texto real do slot "heading" do template usado pelos
 * slides gerados (GENERATED_CAROUSEL_TEMPLATE_ID/GENERATED_CAROUSEL_TEXT_SLOT
 * — ver carousel-state.ts), nas dimensões reais do formato escolhido
 * (quadrado ou vertical). Exportada à parte para poder ser testada sem
 * precisar de um <canvas> de verdade.
 */
export function resolveGeneratedSlideTextBox(formatId: CarouselFormatId): TextBlockBox {
  const format = getFormatById(formatId);
  const template = getTemplateById(GENERATED_CAROUSEL_TEMPLATE_ID);
  const slot = template.slots[GENERATED_CAROUSEL_TEXT_SLOT];
  const font = getFontById(template.defaultFontId);

  return resolveTextBlockBox({
    maxWidthFrac: slot.layout.maxWidthFrac,
    fontSizeFrac: slot.layout.fontSizeFrac,
    fontWeight: slot.layout.fontWeight,
    lineHeight: slot.layout.lineHeight,
    fontFamily: font.family,
    canvasWidth: format.width,
    canvasHeight: format.height,
  });
}

/**
 * Cria um medidor de texto de verdade a partir de um `<canvas>` fora da
 * tela (nunca inserido no DOM) — só funciona no navegador. Único ponto de
 * todo o "Carrossel automático" que efetivamente usa a Canvas API real; o
 * resto (generate-slides-from-text.ts, text-fit.ts) só depende da
 * interface estrutural `TextMeasurer`.
 */
export function createRealTextMeasurer(): TextMeasurer {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Não foi possível preparar a medição de texto neste navegador.");
  }
  return ctx as unknown as TextMeasurer;
}

/**
 * Monta um `BackgroundImageState` completo a partir só dos campos que vêm
 * de um upload novo (mesmo formato que `BackgroundControls.tsx` já usa em
 * `onImageChange`) — reaproveita `createEmptyBackgroundImage` de
 * editor-state.ts em vez de duplicar os valores padrão (foco central,
 * zoom 1, "cover", sem véu) aqui.
 */
export function buildSeedBackgroundImage(
  image: Pick<BackgroundImageState, "url" | "fileName" | "naturalWidth" | "naturalHeight">
): BackgroundImageState {
  return { ...createEmptyBackgroundImage(), ...image };
}

export interface AutoCarouselResult {
  state: CarouselEditorState;
  /**
   * Texto que sobrou por ultrapassar MAX_CAROUSEL_SLIDES (o teto do
   * próprio editor, 20 slides) — `null` quando tudo coube. Nunca
   * descartado silenciosamente: quem chama decide o que fazer (mostrar o
   * aviso "Reduzir conteúdo" / "Criar outro carrossel com o restante").
   */
  overflowText: string | null;
}

/**
 * Ponto de entrada único do "Carrossel automático": divide `text` em
 * pedaços que cabem de verdade no template gerado (generateSlidesFromText,
 * priorizando parágrafo > frase > palavra — nunca por quantidade fixa de
 * caracteres) e monta o `CarouselEditorState` completo, com `seedImage`
 * aplicada a todos os slides (um clone independente por slide — ver
 * `createCarouselStateFromTextChunks`). Usada tanto pela tela de criação
 * (Estado 1, "Gerar carrossel") quanto por "Redistribuir texto" (Estado 2,
 * que chama de novo com o mesmo `originalText` já salvo).
 */
export async function buildCarouselFromPastedText(params: {
  text: string;
  seedImage: BackgroundImageState;
  formatId: CarouselFormatId;
  /** Só para testes — em produção sempre usa um <canvas> real (createRealTextMeasurer). */
  measurer?: TextMeasurer;
}): Promise<AutoCarouselResult> {
  const box = resolveGeneratedSlideTextBox(params.formatId);
  const ctx = params.measurer ?? createRealTextMeasurer();
  const { slides: chunks, overflowText } = generateSlidesFromText(ctx, params.text, box, MAX_CAROUSEL_SLIDES);

  if (chunks.length === 0) {
    throw new Error("Cole algum texto antes de gerar o carrossel.");
  }

  const state = await createCarouselStateFromTextChunks(chunks, params.formatId, params.seedImage, params.text);
  return { state, overflowText };
}
