import "server-only";
import path from "node:path";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { put } from "@vercel/blob";
import { getFormatById } from "../formats";
import type { PostFormat } from "../formats";
import {
  createInitialEditorState,
  deserializeEditorState,
  setBackgroundImageOverlayOpacity,
  updateTextStyle,
  updateTextValue,
  EDITOR_STATE_SCHEMA_VERSION,
  type PostEditorState,
} from "../editor-state";
import { getTemplateById, isPostTemplateId, TEXT_SLOT_IDS, type PostTemplateId, type TextSlotId } from "../templates";
import type { RenderableImage, RenderingContext2DLike } from "../render";
import { insertInstagramMedia } from "./media-repository";
import { computeCoverRect } from "../layout-math";
import { isValidHexColor } from "../colors";
import { fitTextBlock, resolveTextBlockBox, type TextBlockBox, type TextMeasurer } from "../carousel/text-fit";
import { generateSlidesFromText } from "../carousel/generate-slides-from-text";

/**
 * Renderização server-side do template do compositor (Piloto Automático,
 * modo de imagem "AUTO_TEMPLATE" — ver docs/content-automation.md §2.2).
 * Reaproveita INTEIRAMENTE o motor de desenho do compositor manual
 * (drawPost, lib/instagram/render.ts) e as funções puras de
 * lib/instagram/editor-state.ts — a única coisa nova aqui é a origem do
 * contexto de desenho e da imagem (@napi-rs/canvas em vez do <canvas> do
 * navegador), que implementa a mesma Canvas 2D API.
 *
 * Fonte do texto desenhado sobre a imagem: as fontes do editor (lib/
 * instagram/fonts.ts, ex. Georgia/Times New Roman) são fontes de SISTEMA
 * do navegador/SO do usuário — o container Linux da function da Vercel
 * não tem NENHUMA fonte instalada. Sem registrar um arquivo de fonte
 * próprio, @napi-rs/canvas não encontra nenhum glifo pra desenhar e o
 * texto sai invisível — só a imagem de fundo aparece (bug relatado: "a
 * automação gera a imagem mas o texto não aparece", embora o mesmo
 * fluxo funcione perfeitamente no editor manual, que desenha no
 * navegador). Corrigido embutindo a fonte DejaVu Serif (licença livre,
 * arquivos em ./fonts/) e registrando via GlobalFonts.registerFromPath
 * (ensureAutomationFontsRegistered, abaixo) antes de desenhar. Usamos
 * APENAS essa fonte (nunca Georgia/Times como fallback) para que a
 * prévia (que pode rodar num ambiente com essas fontes de sistema) e o
 * resultado publicado de verdade (que nunca tem) desenhem sempre
 * idênticos — ver AUTOMATION_FONT_FAMILY.
 */

export class TemplateRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateRenderError";
  }
}

/** Formato usado para a arte gerada automaticamente — vertical (4:5), o mais comum no feed. */
export const AUTO_TEMPLATE_FORMAT_ID = "vertical";

/**
 * Formatos que o Piloto Automático sabe desenhar: "vertical" (feed, 4:5 —
 * padrão de Post/Carrossel) e "stories" (1080×1920, 9:16 — Stories). O
 * bloco de texto é o MESMO em proporção nos dois: centralizado, até 62% da
 * altura (TEXT_SLOT_MAX_BLOCK_HEIGHT_FRAC) e 78% da largura — no Story
 * isso deixa ~365px livres em cima e embaixo, fora das áreas que o
 * Instagram cobre com a barra de progresso/perfil (topo) e a caixa de
 * resposta (rodapé), e ~119px de margem em cada lateral.
 */
export type AutomationArtFormatId = "vertical" | "stories";

/**
 * Slot de texto que recebe o texto visual (IA ou manual). Fixo em
 * "heading" nesta etapa — todos os 5 templates existentes o usam como
 * destaque principal; um seletor por dia (escolher outro slot) fica para
 * uma fase 2, junto do editor de estilo completo.
 */
export const AUTO_TEMPLATE_TEXT_SLOT: TextSlotId = "heading";

/**
 * Template usado quando o dia não escolheu nenhum explicitamente. Corrige
 * o bug relatado de "texto só na legenda"/"imagem errada": o padrão
 * histórico do editor manual ("promocao") reserva a foto numa área
 * pequena recortada (não em tela cheia) e tem badge/body/footer com
 * textos de exemplo próprios ("50% OFF", "Sua Loja Aqui") — exatamente o
 * oposto do que o Piloto Automático precisa (a foto escolhida como fundo
 * real, com só a frase gerada por cima). "frase-motivacional" já é o
 * template com foto em tela cheia + frase central + tipografia forte —
 * o pedido de um template "Motivação Clean" já existe pronto aqui.
 */
export const AUTO_TEMPLATE_DEFAULT_TEMPLATE_ID: PostTemplateId = "frase-motivacional";

/** Opacidade padrão do véu sobre a foto quando o dia não configurou nenhuma (20%, conforme pedido). */
export const AUTO_TEMPLATE_DEFAULT_OVERLAY_OPACITY = 0.2;

/** Níveis de véu permitidos na UI — nunca um valor arbitrário digitado à mão. */
export const AUTO_TEMPLATE_OVERLAY_LEVELS = [0, 0.1, 0.2, 0.3, 0.4] as const;

/**
 * @napi-rs/canvas usa escala 0..100 para JPEG em `toBuffer("image/jpeg")`.
 * O fluxo manual do browser usa 0.92 porque `HTMLCanvasElement.toBlob`
 * espera 0..1; repetir esse número aqui gerava uma saída comprimida demais.
 */
export const AUTO_TEMPLATE_JPEG_QUALITY = 92;
export const AUTO_TEMPLATE_RENDER_VERSION = "v4-bundled-font";

const NON_VISUAL_TEXT_SLOTS: TextSlotId[] = TEXT_SLOT_IDS.filter((slotId) => slotId !== AUTO_TEMPLATE_TEXT_SLOT);

/**
 * Família usada em TODO texto desenhado pelo Piloto Automático (nunca
 * Georgia/Times New Roman — ver comentário de RenderedAutomationArt
 * acima). DejaVu Serif: fonte livre (licença em ./fonts/LICENSE-
 * DejaVu.txt), visualmente próxima de uma serifada clássica, arquivo
 * embutido no repositório (não depende de nenhuma fonte do ambiente).
 */
const AUTOMATION_FONT_FAMILY = "Alilu Automation Serif";

const AUTOMATION_FONT_FILES = [
  path.join(process.cwd(), "lib/instagram/backend/fonts/DejaVuSerif.ttf"),
  path.join(process.cwd(), "lib/instagram/backend/fonts/DejaVuSerif-Bold.ttf"),
];

let automationFontsRegistered = false;

/**
 * Registra as fontes da automação no processo uma única vez (GlobalFonts
 * é global ao processo do @napi-rs/canvas — registrar de novo a cada
 * chamada é redundante; o alias repetido faz o registro assumir "já
 * registrado" e não falha, mas evitamos a chamada extra mesmo assim).
 * Marca `automationFontsRegistered = true` mesmo se `registerFromPath`
 * falhar: numa instância de function onde o arquivo não resolve, tentar
 * de novo a cada render não vai mudar o resultado, só desperdiça tempo —
 * o erro já fica no log do console pra investigar.
 */
function ensureAutomationFontsRegistered(): void {
  if (automationFontsRegistered) return;
  automationFontsRegistered = true;
  for (const fontPath of AUTOMATION_FONT_FILES) {
    const key = GlobalFonts.registerFromPath(fontPath, AUTOMATION_FONT_FAMILY);
    if (!key) {
      console.error("[template-render-service] falha ao registrar fonte da automação", { fontPath });
    }
  }
}

/** Cor padrão do texto quando o dia não escolheu nenhuma — branco, igual ao default do template "frase-motivacional" (combo "midnight", ver lib/instagram/colors.ts) que o editor manual já usa. */
export const AUTOMATION_DEFAULT_TEXT_COLOR = "#ffffff";

/**
 * Proporções do bloco de texto do Piloto Automático — as MESMAS para uma
 * imagem única (POST) e para cada slide de um carrossel (CAROUSEL),
 * porque `resolveAutomationTextBox` (abaixo) é usada tanto para desenhar
 * quanto para PLANEJAR onde cortar um texto comprido em slides
 * (splitAutomationVisualText/generateSlidesFromText) — exatamente o
 * mesmo princípio de text-fit.ts/auto-carousel.ts para o Carrossel
 * automático manual: o que o planejamento decide que "cabe" sempre bate
 * com o que o desenho de verdade produz.
 */
const AUTOMATION_TEXT_MAX_WIDTH_FRAC = 0.78;
const AUTOMATION_TEXT_FONT_SIZE_FRAC = 0.07;
const AUTOMATION_TEXT_LINE_HEIGHT = 1.22;

/**
 * Story (9:16) é a única peça que comunica só pelo texto da arte — o
 * texto pode ter 2 parágrafos / ~100 palavras. Usa quase toda a altura e
 * deixa a fonte encolher mais (ainda legível no celular) antes de cortar.
 */
const STORY_TEXT_MAX_BLOCK_HEIGHT_FRAC = 0.74;
const STORY_TEXT_MIN_FONT_SIZE_FRAC = 0.036;

function isVerticalStoryFormat(format: PostFormat): boolean {
  return format.height >= format.width * 1.5;
}

function resolveAutomationTextBox(format: PostFormat): TextBlockBox {
  const box = resolveTextBlockBox({
    maxWidthFrac: AUTOMATION_TEXT_MAX_WIDTH_FRAC,
    fontSizeFrac: AUTOMATION_TEXT_FONT_SIZE_FRAC,
    fontWeight: "bold",
    lineHeight: AUTOMATION_TEXT_LINE_HEIGHT,
    fontFamily: `"${AUTOMATION_FONT_FAMILY}"`,
    canvasWidth: format.width,
    canvasHeight: format.height,
  });
  if (!isVerticalStoryFormat(format)) return box;
  return {
    ...box,
    maxBlockHeightPx: format.height * STORY_TEXT_MAX_BLOCK_HEIGHT_FRAC,
    minFontSizePx: Math.max(8, Math.round(format.width * STORY_TEXT_MIN_FONT_SIZE_FRAC)),
  };
}

/**
 * Canvas pequeno, nunca desenhado, só para medir texto (`measureText`
 * depende da fonte carregada no processo, não do tamanho do canvas) —
 * usado para PLANEJAR a divisão em slides (splitAutomationVisualText)
 * antes de desenhar de verdade cada um.
 */
function createAutomationTextMeasurer(): TextMeasurer {
  ensureAutomationFontsRegistered();
  const canvas = createCanvas(64, 64);
  return canvas.getContext("2d") as unknown as TextMeasurer;
}

/**
 * Divide um texto comprido nos pedaços que cabem em cada slide do
 * Piloto Automático — MESMO motor (generateSlidesFromText) e MESMA
 * prioridade de quebra (parágrafo > frase > palavra) do Carrossel
 * automático manual (lib/instagram/carousel/auto-carousel.ts), só que
 * medindo com a fonte embutida do servidor em vez de um <canvas> do
 * navegador. `overflowText` nunca é descartado silenciosamente — quem
 * chama decide o que fazer (o cron loga; a prévia mostra um aviso).
 */
/**
 * O texto cabe inteiro numa única arte deste formato (sem corte com "…")?
 * Mesma medição de drawAutomationVisualText — usada em testes e para
 * diagnosticar Stories longos.
 */
export function automationVisualTextFits(formatId: string, visualText: string): { fits: boolean; fontSizePx: number; lines: number } {
  const format = getFormatById(formatId);
  const box = resolveAutomationTextBox(format);
  const result = fitTextBlock(createAutomationTextMeasurer(), visualText.trim(), box);
  return { fits: result.fits, fontSizePx: result.fontSizePx, lines: result.lines.length };
}

export function splitAutomationVisualText(
  visualText: string,
  maxSlides: number
): { slideTexts: string[]; overflowText: string | null } {
  const format = getFormatById(AUTO_TEMPLATE_FORMAT_ID);
  const box = resolveAutomationTextBox(format);
  const measurer = createAutomationTextMeasurer();
  const { slides, overflowText } = generateSlidesFromText(measurer, visualText.trim(), box, maxSlides);
  return { slideTexts: slides, overflowText };
}

/**
 * Desenha UM texto (a frase inteira de um POST, ou já o pedaço de um
 * slide de CAROUSEL) sobre o canvas, encolhendo a fonte até caber
 * (fitTextBlock — mesmo ajuste dinâmico de render.ts/drawTextSlots) e
 * cortando com "…" só no caso extremo de nem no piso de legibilidade
 * caber inteiro (nunca deveria acontecer: o texto de POST é curto, e
 * cada slide de CAROUSEL já foi medido para caber por
 * splitAutomationVisualText — fica como rede de segurança).
 *
 * SEM faixa/sombra atrás do texto (removida: bug relatado — a imagem já
 * escura ficava com uma faixa preta extra em cima, redundante com o véu
 * configurável, que já existe para legibilidade). A cor é escolhida pelo
 * usuário (visualTextColor); branco é o padrão.
 */
function drawAutomationVisualText(
  ctx: RenderingContext2DLike,
  format: PostFormat,
  visualText: string,
  color: string | null | undefined
): void {
  const text = visualText.trim();
  if (!text) return;

  const box = resolveAutomationTextBox(format);
  const { lines, fontSizePx } = fitTextBlock(ctx as unknown as TextMeasurer, text, box);
  const lineHeightPx = Math.round(fontSizePx * box.lineHeight);

  const maxLines = Math.max(1, Math.floor(box.maxBlockHeightPx / lineHeightPx));
  const finalLines =
    lines.length > maxLines
      ? [...lines.slice(0, maxLines - 1), `${lines[maxLines - 1].replace(/[.,;:!?…]*$/, "")}…`]
      : lines;

  const totalHeight = finalLines.length * lineHeightPx;
  const startY = format.height * 0.5 - totalHeight / 2 + lineHeightPx / 2;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${fontSizePx}px "${AUTOMATION_FONT_FAMILY}"`;
  ctx.fillStyle = color && isValidHexColor(color) ? color : AUTOMATION_DEFAULT_TEXT_COLOR;
  for (const [index, line] of finalLines.entries()) {
    ctx.fillText(line, format.width * 0.5, startY + index * lineHeightPx);
  }
  ctx.restore();
}

function drawAutomationBackground(
  ctx: RenderingContext2DLike,
  format: PostFormat,
  sourceImage: RenderableImage,
  overlayOpacity: number | null | undefined
): void {
  const cover = computeCoverRect(
    format.width,
    format.height,
    sourceImage.naturalWidth,
    sourceImage.naturalHeight,
    0.5,
    0.5,
    1
  );
  ctx.clearRect(0, 0, format.width, format.height);
  ctx.drawImage(
    sourceImage,
    cover.sx,
    cover.sy,
    cover.sWidth,
    cover.sHeight,
    0,
    0,
    format.width,
    format.height
  );
  const opacity = overlayOpacity ?? AUTO_TEMPLATE_DEFAULT_OVERLAY_OPACITY;
  if (opacity > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, Math.max(0, opacity))})`;
    ctx.fillRect(0, 0, format.width, format.height);
  }
}

function buildBaseEditorState(
  templateId: string | null,
  styleConfig: Record<string, unknown> | null
): PostEditorState {
  if (styleConfig) {
    const restored = deserializeEditorState({ version: EDITOR_STATE_SCHEMA_VERSION, state: styleConfig }, null);
    if (restored) return restored;
  }
  const safeTemplateId =
    templateId && isPostTemplateId(templateId) ? (templateId as PostTemplateId) : AUTO_TEMPLATE_DEFAULT_TEMPLATE_ID;
  return createInitialEditorState(safeTemplateId, AUTO_TEMPLATE_FORMAT_ID);
}

export interface RenderAutomationArtInput {
  userId: string;
  /** Formato da arte — `undefined` = "vertical" (comportamento histórico de Post). Stories usam "stories". */
  formatId?: AutomationArtFormatId;
  /** templateId e styleConfig salvos no dia (content_automation_days.template_id/style_config). */
  templateId: string | null;
  styleConfig: Record<string, unknown> | null;
  /** URL pública (Vercel Blob) da foto de origem — a mesma resolvida hoje por resolveImageMediaId no cron. */
  sourceImageUrl: string;
  /** Id da mídia de origem (instagram_media), só para rastreabilidade. */
  sourceMediaId: string | null;
  /** Texto curto a desenhar sobre a imagem — gerado pela IA ou escrito manualmente pelo usuário. */
  visualText: string;
  /**
   * Opacidade (0..1) do véu escuro sobre a foto, só para legibilidade —
   * ver render.ts/drawBackgroundOverlay. `undefined`/`null` usa o padrão
   * (20%, AUTO_TEMPLATE_DEFAULT_OVERLAY_OPACITY).
   */
  overlayOpacity?: number | null;
  /** Cor (hex "#rrggbb") do texto — `undefined`/`null` usa o padrão (branco, AUTOMATION_DEFAULT_TEXT_COLOR). */
  visualTextColor?: string | null;
  /** Id da execução (automation_runs), só para rastreabilidade. */
  automationRunId: string | null;
}

export interface RenderedAutomationArt {
  buffer: Buffer;
  contentType: "image/jpeg";
  templateIdUsed: PostTemplateId;
  sourceWidth: number;
  sourceHeight: number;
  finalWidth: number;
  finalHeight: number;
  jpegQuality: number;
  renderVersion: string;
}

/**
 * Monta o estado do editor pronto para desenhar: aplica o template (ou o
 * padrão "frase-motivacional"), injeta o texto visual no slot certo e
 * SEMPRE limpa os outros três slots (badge/body/footer) — nenhum deles
 * tem campo próprio no Piloto Automático hoje, então deixá-los com o
 * valor padrão do template ("50% OFF", "Sua Loja Aqui" etc.) vazava texto
 * indesejado dentro da arte gerada (bug relatado: "texto visual da imagem
 * e a legenda estão misturados de forma errada"). Aplica também o véu
 * configurável sobre a foto (0/10/20/30/40%, padrão 20%).
 */
export function buildAutomationArtState(
  input: Pick<RenderAutomationArtInput, "templateId" | "styleConfig" | "visualText" | "overlayOpacity">
): { state: PostEditorState; templateIdUsed: PostTemplateId } {
  let state = buildBaseEditorState(input.templateId, input.styleConfig);
  state = updateTextValue(state, AUTO_TEMPLATE_TEXT_SLOT, input.visualText);
  for (const slotId of NON_VISUAL_TEXT_SLOTS) {
    state = updateTextValue(state, slotId, "");
  }
  if (getTemplateById(state.templateId).imageArea === null) {
    state = updateTextStyle(state, AUTO_TEMPLATE_TEXT_SLOT, { color: "#ffffff", bold: true });
  }
  const overlayOpacity = input.overlayOpacity ?? AUTO_TEMPLATE_DEFAULT_OVERLAY_OPACITY;
  state = setBackgroundImageOverlayOpacity(state, overlayOpacity);
  return { state, templateIdUsed: state.templateId };
}

/**
 * Desenha o template com o texto visual sobre a imagem de origem e
 * devolve só os bytes prontos (JPEG) — sem subir nada nem gravar no
 * banco. Usado tanto pela geração real (renderAndStoreAutomationArt,
 * abaixo) quanto pela prévia (Parte 8: "o preview deve representar
 * fielmente o resultado final" — a prévia chama exatamente esta mesma
 * função, nunca uma implementação separada, para nunca divergir do
 * resultado final).
 */
export async function renderAutomationArtBuffer(
  input: Pick<
    RenderAutomationArtInput,
    "templateId" | "styleConfig" | "sourceImageUrl" | "visualText" | "overlayOpacity" | "visualTextColor" | "formatId"
  >
): Promise<RenderedAutomationArt> {
  ensureAutomationFontsRegistered();
  const format = getFormatById(input.formatId ?? AUTO_TEMPLATE_FORMAT_ID);
  const { templateIdUsed } = buildAutomationArtState(input);

  let sourceImage: Awaited<ReturnType<typeof loadImage>>;
  try {
    sourceImage = await loadImage(input.sourceImageUrl);
  } catch (error) {
    throw new TemplateRenderError(
      `Não foi possível carregar a imagem de origem para gerar a arte: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const canvas = createCanvas(format.width, format.height);
  const ctx = canvas.getContext("2d");
  const renderContext = ctx as unknown as RenderingContext2DLike;
  drawAutomationBackground(renderContext, format, sourceImage as unknown as RenderableImage, input.overlayOpacity);
  drawAutomationVisualText(renderContext, format, input.visualText, input.visualTextColor);

  const buffer = canvas.toBuffer("image/jpeg", AUTO_TEMPLATE_JPEG_QUALITY);
  return {
    buffer,
    contentType: "image/jpeg",
    templateIdUsed,
    sourceWidth: sourceImage.naturalWidth,
    sourceHeight: sourceImage.naturalHeight,
    finalWidth: format.width,
    finalHeight: format.height,
    jpegQuality: AUTO_TEMPLATE_JPEG_QUALITY,
    renderVersion: AUTO_TEMPLATE_RENDER_VERSION,
  };
}

/**
 * Desenha o template com o texto visual sobre a imagem de origem, sobe o
 * resultado ao Vercel Blob (mesmo storage do upload manual — put() aceita
 * a mesma autenticação OIDC já usada pela rota de upload, sem precisar de
 * BLOB_READ_WRITE_TOKEN novo) e grava a linha em instagram_media,
 * retornando o novo mediaId pronto para createDraftImagePost.
 */
export async function renderAndStoreAutomationArt(input: RenderAutomationArtInput): Promise<string> {
  const { buffer, templateIdUsed, sourceWidth, sourceHeight, finalWidth, finalHeight, jpegQuality } =
    await renderAutomationArtBuffer(input);

  const blob = await put(`instagram-media/${input.userId}/generated/${Date.now()}.jpg`, buffer, {
    access: "public",
    addRandomSuffix: true,
    contentType: "image/jpeg",
  });

  // Debug (Parte 11 do briefing) — nunca loga tokens/segredos/API keys,
  // só metadados de rastreabilidade já públicos na própria linha gerada.
  console.info("[template-render-service] arte AUTO_TEMPLATE gerada", {
    userId: input.userId,
    automationRunId: input.automationRunId,
    sourceMediaId: input.sourceMediaId,
    sourceImage: `${sourceWidth}x${sourceHeight}`,
    finalImage: `${finalWidth}x${finalHeight}`,
    jpegQuality,
    renderVersion: AUTO_TEMPLATE_RENDER_VERSION,
    fileSizeBytes: buffer.byteLength,
    templateIdUsed,
    overlayOpacity: input.overlayOpacity ?? AUTO_TEMPLATE_DEFAULT_OVERLAY_OPACITY,
    visualTextColor: input.visualTextColor ?? AUTOMATION_DEFAULT_TEXT_COLOR,
    visualTextLength: input.visualText.length,
    renderedMediaUrl: blob.url,
  });

  return insertInstagramMedia({
    userId: input.userId,
    storageUrl: blob.url,
    mediaType: "image",
    fileSizeBytes: buffer.byteLength,
    originalFilename: null,
    generatedFromMediaId: input.sourceMediaId,
    automationRunId: input.automationRunId,
  });
}


/**
 * Entrada de renderAutomationCarouselBuffers/renderAndStoreAutomationCarousel
 * — igual a RenderAutomationArtInput, mas `visualText` é o texto INTEIRO
 * colado/gerado (não um slide já pronto) e `maxSlides` é obrigatório:
 * quem chama decide o teto (o cron usa MAX_CAROUSEL_ITEMS da Meta, 10; a
 * prévia pode usar um valor menor pra ficar rápida).
 */
export interface RenderAutomationCarouselInput {
  templateId: string | null;
  styleConfig: Record<string, unknown> | null;
  sourceImageUrl: string;
  visualText: string;
  overlayOpacity?: number | null;
  visualTextColor?: string | null;
  maxSlides: number;
}

export interface RenderedAutomationCarouselSlide extends RenderedAutomationArt {
  /** O pedaço de texto deste slide (depois de splitAutomationVisualText). */
  text: string;
}

export interface RenderedAutomationCarousel {
  /** Um item por slide, já na ordem de publicação. */
  slides: RenderedAutomationCarouselSlide[];
  /**
   * Texto que sobrou por ultrapassar `maxSlides` — `null` quando tudo
   * coube. Nunca descartado silenciosamente (mesma garantia do Carrossel
   * automático manual) — quem chama decide o que fazer (o cron só loga;
   * a rota de prévia devolve para a tela mostrar um aviso).
   */
  overflowText: string | null;
}

/**
 * Divide `input.visualText` em slides (splitAutomationVisualText) e
 * desenha cada um — MESMA imagem de fundo e MESMO template/véu/cor em
 * todos os slides (só o texto muda), igual ao "Trocar imagem de fundo"
 * do Carrossel automático manual, que também aplica uma única imagem a
 * todos os slides de uma vez. Nunca grava nada (sem Blob, sem banco) —
 * usada tanto pela geração real (renderAndStoreAutomationCarousel)
 * quanto pela prévia, para as duas nunca divergirem (mesmo princípio de
 * renderAutomationArtBuffer).
 */
export async function renderAutomationCarouselBuffers(
  input: RenderAutomationCarouselInput
): Promise<RenderedAutomationCarousel> {
  ensureAutomationFontsRegistered();
  const format = getFormatById(AUTO_TEMPLATE_FORMAT_ID);
  const { templateIdUsed } = buildAutomationArtState({
    templateId: input.templateId,
    styleConfig: input.styleConfig,
    visualText: "",
    overlayOpacity: input.overlayOpacity,
  });

  const trimmedText = input.visualText.trim();
  if (!trimmedText) {
    throw new TemplateRenderError("Escreva o texto do carrossel antes de gerar.");
  }

  const { slideTexts, overflowText } = splitAutomationVisualText(trimmedText, input.maxSlides);
  if (slideTexts.length === 0) {
    throw new TemplateRenderError("Não foi possível dividir o texto em slides — tente um texto mais curto.");
  }

  let sourceImage: Awaited<ReturnType<typeof loadImage>>;
  try {
    sourceImage = await loadImage(input.sourceImageUrl);
  } catch (error) {
    throw new TemplateRenderError(
      `Não foi possível carregar a imagem de origem para gerar a arte: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const slides: RenderedAutomationCarouselSlide[] = slideTexts.map((slideText) => {
    const canvas = createCanvas(format.width, format.height);
    const ctx = canvas.getContext("2d");
    const renderContext = ctx as unknown as RenderingContext2DLike;
    drawAutomationBackground(renderContext, format, sourceImage as unknown as RenderableImage, input.overlayOpacity);
    drawAutomationVisualText(renderContext, format, slideText, input.visualTextColor);
    const buffer = canvas.toBuffer("image/jpeg", AUTO_TEMPLATE_JPEG_QUALITY);
    return {
      buffer,
      contentType: "image/jpeg",
      templateIdUsed,
      sourceWidth: sourceImage.naturalWidth,
      sourceHeight: sourceImage.naturalHeight,
      finalWidth: format.width,
      finalHeight: format.height,
      jpegQuality: AUTO_TEMPLATE_JPEG_QUALITY,
      renderVersion: AUTO_TEMPLATE_RENDER_VERSION,
      text: slideText,
    };
  });

  return { slides, overflowText };
}

/**
 * Igual a renderAndStoreAutomationArt, mas para os N slides de um
 * carrossel: sobe cada imagem ao Blob e grava uma linha em
 * instagram_media por slide (mesma função insertInstagramMedia, sem
 * tabela nova), devolvendo os ids já na ordem de publicação — prontos
 * para createDraftCarouselPost (instagram-post-repository.ts).
 */
export async function renderAndStoreAutomationCarousel(
  input: RenderAutomationCarouselInput & {
    userId: string;
    sourceMediaId: string | null;
    automationRunId: string | null;
  }
): Promise<{ mediaIds: string[]; overflowText: string | null }> {
  const { slides, overflowText } = await renderAutomationCarouselBuffers(input);

  const mediaIds: string[] = [];
  for (const [index, slide] of slides.entries()) {
    const blob = await put(`instagram-media/${input.userId}/generated/${Date.now()}-${index}.jpg`, slide.buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: "image/jpeg",
    });
    const mediaId = await insertInstagramMedia({
      userId: input.userId,
      storageUrl: blob.url,
      mediaType: "image",
      fileSizeBytes: slide.buffer.byteLength,
      originalFilename: null,
      generatedFromMediaId: input.sourceMediaId,
      automationRunId: input.automationRunId,
    });
    mediaIds.push(mediaId);
  }

  // Debug (mesmo padrão de renderAndStoreAutomationArt) — nunca loga
  // tokens/segredos, só metadados de rastreabilidade já públicos.
  console.info("[template-render-service] carrossel AUTO_TEMPLATE gerado", {
    userId: input.userId,
    automationRunId: input.automationRunId,
    sourceMediaId: input.sourceMediaId,
    slideCount: slides.length,
    hasOverflowText: overflowText !== null,
    renderVersion: AUTO_TEMPLATE_RENDER_VERSION,
    overlayOpacity: input.overlayOpacity ?? AUTO_TEMPLATE_DEFAULT_OVERLAY_OPACITY,
    visualTextColor: input.visualTextColor ?? AUTOMATION_DEFAULT_TEXT_COLOR,
    mediaIds,
  });

  return { mediaIds, overflowText };
}
