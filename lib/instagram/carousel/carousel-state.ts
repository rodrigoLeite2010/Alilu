/**
 * Estado do Criador de Carrosséis (Fase 2, ETAPAs 2–4). Reaproveita o
 * modelo de dados inteiro do Criador de Posts (PostEditorState) em vez de
 * criar um sistema de elementos gráficos paralelo — cada slide do
 * carrossel é, literalmente, um post independente:
 *
 *   interface CarouselSlide { id, order, state: PostEditorState }
 *
 * Isso é o que permite reutilizar TODO o editor existente (EditorPreviewCanvas,
 * StructureControls, TextControls, BackgroundControls, render.ts, export.ts)
 * sem nenhuma duplicação de lógica de desenho ou de campos de texto/imagem.
 *
 * Mantido sem nenhuma dependência de Canvas/DOM (exceto pela clonagem de
 * imagem, que precisa de `fetch`/`URL.createObjectURL` do navegador) para
 * poder ser testado diretamente.
 */

import {
  clearBackgroundImage,
  applyTemplateToState,
  createInitialEditorState,
  setFormat as setPostFormat,
  updateTextValue,
  type BackgroundImageState,
  type PostEditorState,
} from "../editor-state";
import { IMAGE_ONLY_TEMPLATE_ID, type PostTemplateId, type TextSlotId } from "../templates";
import type { PostFormatId } from "../formats";
import { revokeImageObjectUrl } from "../image-utils";

/** O carrossel só oferece quadrado e vertical (ETAPA 5) — Stories/Reels fica de fora. */
export type CarouselFormatId = Extract<PostFormatId, "quadrado" | "vertical">;
export const CAROUSEL_FORMAT_IDS: CarouselFormatId[] = ["quadrado", "vertical"];
export const DEFAULT_CAROUSEL_FORMAT_ID: CarouselFormatId = "quadrado";

/** Template padrão de um slide novo: "comunicado" tem título + texto + imagem em tela cheia opcional, o mais versátil para conteúdo avulso de carrossel. */
export const DEFAULT_CAROUSEL_TEMPLATE_ID: PostTemplateId = "comunicado";

export const MIN_CAROUSEL_SLIDES = 1;
export const INITIAL_CAROUSEL_SLIDES = 5;
export const MAX_CAROUSEL_SLIDES = 20;

/**
 * Limites de publicação de verdade no Instagram (2 a 10 imagens por
 * carrossel — o mínimo é uma decisão do ALILU, o máximo é da própria
 * Meta). O editor em si permite montar até MAX_CAROUSEL_SLIDES (20)
 * slides — bem mais que o publicável — porque também serve para baixar
 * em ZIP. Fonte única para o lado do cliente: components/instagram/
 * CarouselPublishPanel.tsx importa daqui em vez de ter sua própria
 * cópia, e o "Carrossel automático" (generate-slides-from-text.ts) usa
 * os mesmos números para avisar sobre o limite já na tela de geração,
 * antes de gastar tempo desenhando/publicando. Os mesmos dois números
 * também existem no lado do servidor, em lib/instagram/backend/
 * instagram-post-service.ts — duplicados ali por necessidade (código
 * "server-only" não pode ser importado por um Client Component).
 */
export const MIN_CAROUSEL_PUBLISH_ITEMS = 2;
export const MAX_CAROUSEL_PUBLISH_ITEMS = 10;

/**
 * Template usado pelos slides do "Carrossel automático" (texto colado →
 * slides gerados sozinhos): "Frase motivacional" é o único dos cinco
 * templates cujo rótulo e rodapé já nascem vazios por padrão — um bloco
 * de texto grande e centralizado, sem nenhuma marca/rótulo fixo
 * competindo com o conteúdo colado pelo usuário (ver lib/instagram/
 * templates.ts). O texto gerado vai sempre no slot "heading" (o único
 * slot multilinha e generoso o bastante deste template).
 */
export const GENERATED_CAROUSEL_TEMPLATE_ID: PostTemplateId = "frase-motivacional";
export const GENERATED_CAROUSEL_TEXT_SLOT: TextSlotId = "heading";

export interface CarouselSlide {
  id: string;
  order: number;
  state: PostEditorState;
}

export interface CarouselEditorState {
  formatId: CarouselFormatId;
  slides: CarouselSlide[];
  selectedSlideId: string;
  /**
   * Texto completo colado pelo usuário no "Carrossel automático", ANTES de
   * ser dividido em slides — preservado à parte do conteúdo dos slides
   * (nunca reconstruído juntando de volta `slide.state.texts[...]`, o que
   * perderia parágrafos/formatação). Usado por "Redistribuir texto" (refaz
   * a divisão do zero) e por "Editar texto original" (volta para o Estado
   * 1 com a textarea pré-preenchida). `undefined` para carrosséis montados
   * manualmente slide a slide (fluxo antigo), que não têm um texto de
   * origem único.
   */
  originalText?: string;
}

let slideIdCounter = 0;

/** Identificador estável (ETAPA 3) — nunca reaproveitado, mesmo depois de excluir/duplicar slides. */
export function createSlideId(): string {
  slideIdCounter += 1;
  return `slide-${slideIdCounter}-${Math.random().toString(36).slice(2, 9)}`;
}

function reindex(slides: CarouselSlide[]): CarouselSlide[] {
  return slides.map((slide, index) => (slide.order === index ? slide : { ...slide, order: index }));
}

export function createCarouselSlide(
  formatId: CarouselFormatId,
  templateId: PostTemplateId = DEFAULT_CAROUSEL_TEMPLATE_ID
): CarouselSlide {
  return {
    id: createSlideId(),
    order: 0,
    state: createInitialEditorState(templateId, formatId),
  };
}

export function createInitialCarouselState(
  formatId: CarouselFormatId = DEFAULT_CAROUSEL_FORMAT_ID,
  slideCount: number = INITIAL_CAROUSEL_SLIDES
): CarouselEditorState {
  const slides = reindex(
    Array.from({ length: slideCount }, () => createCarouselSlide(formatId))
  );
  return {
    formatId,
    slides,
    selectedSlideId: slides[0].id,
  };
}

export function canAddSlide(state: CarouselEditorState): boolean {
  return state.slides.length < MAX_CAROUSEL_SLIDES;
}

export function canRemoveSlide(state: CarouselEditorState): boolean {
  return state.slides.length > MIN_CAROUSEL_SLIDES;
}

export function getSelectedSlide(state: CarouselEditorState): CarouselSlide {
  return state.slides.find((slide) => slide.id === state.selectedSlideId) ?? state.slides[0];
}

export function selectSlide(state: CarouselEditorState, slideId: string): CarouselEditorState {
  if (slideId === state.selectedSlideId) return state;
  if (!state.slides.some((slide) => slide.id === slideId)) return state;
  return { ...state, selectedSlideId: slideId };
}

/** Adiciona um slide novo logo após o slide selecionado (ETAPA 2.1) e o seleciona. Não faz nada além do limite de 20 (ETAPA 2.1). */
export function addSlide(state: CarouselEditorState): CarouselEditorState {
  if (!canAddSlide(state)) return state;

  const selectedIndex = state.slides.findIndex((slide) => slide.id === state.selectedSlideId);
  const insertIndex = selectedIndex === -1 ? state.slides.length : selectedIndex + 1;
  const newSlide = createCarouselSlide(state.formatId);

  const slides = [...state.slides];
  slides.splice(insertIndex, 0, newSlide);

  return { ...state, slides: reindex(slides), selectedSlideId: newSlide.id };
}

/**
 * Insere um slide já pronto (usado pela duplicação, ETAPA 3, depois que a
 * imagem de fundo — se houver — já foi clonada para uma URL própria de
 * forma assíncrona por `cloneSlideState`). Mantém o mesmo limite de 20
 * slides do carrossel.
 */
export function insertSlideAfter(
  state: CarouselEditorState,
  afterSlideId: string,
  newSlide: CarouselSlide
): CarouselEditorState {
  if (!canAddSlide(state)) return state;

  const afterIndex = state.slides.findIndex((slide) => slide.id === afterSlideId);
  const insertIndex = afterIndex === -1 ? state.slides.length : afterIndex + 1;

  const slides = [...state.slides];
  slides.splice(insertIndex, 0, newSlide);

  return { ...state, slides: reindex(slides), selectedSlideId: newSlide.id };
}

/**
 * Remove um slide (ETAPA 2.1/3). Nunca remove o último slide restante.
 * Corrige a seleção quando o slide removido era o selecionado — prefere o
 * próximo slide, ou o anterior se o removido era o último da lista.
 * A liberação de memória da imagem de fundo do slide removido é
 * responsabilidade de quem chama esta função (ver
 * `useCarouselEditor`/`CarouselEditorTool`), porque cada slide sempre é
 * dono exclusivo da própria URL (a duplicação sempre clona a imagem para
 * uma URL nova — ver `cloneSlideState`), então revogar aqui nunca afeta
 * outro slide.
 */
export function removeSlide(state: CarouselEditorState, slideId: string): CarouselEditorState {
  if (!canRemoveSlide(state)) return state;

  const index = state.slides.findIndex((slide) => slide.id === slideId);
  if (index === -1) return state;

  const slides = state.slides.filter((slide) => slide.id !== slideId);
  let selectedSlideId = state.selectedSlideId;
  if (selectedSlideId === slideId) {
    const nextIndex = Math.min(index, slides.length - 1);
    selectedSlideId = slides[nextIndex].id;
  }

  return { ...state, slides: reindex(slides), selectedSlideId };
}

function moveIndex<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    fromIndex >= list.length ||
    toIndex < 0 ||
    toIndex >= list.length
  ) {
    return list;
  }
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/** Reordenação por arraste (ETAPA 4) ou por índice programático. Preserva conteúdo e seleção de todos os slides. */
export function reorderSlides(
  state: CarouselEditorState,
  fromIndex: number,
  toIndex: number
): CarouselEditorState {
  const slides = moveIndex(state.slides, fromIndex, toIndex);
  if (slides === state.slides) return state;
  return { ...state, slides: reindex(slides) };
}

export function moveSlideUp(state: CarouselEditorState, slideId: string): CarouselEditorState {
  const index = state.slides.findIndex((slide) => slide.id === slideId);
  if (index <= 0) return state;
  return reorderSlides(state, index, index - 1);
}

export function moveSlideDown(state: CarouselEditorState, slideId: string): CarouselEditorState {
  const index = state.slides.findIndex((slide) => slide.id === slideId);
  if (index === -1 || index >= state.slides.length - 1) return state;
  return reorderSlides(state, index, index + 1);
}

/**
 * Aplica uma transformação (qualquer função de lib/instagram/editor-state.ts,
 * como updateTextValue, setBackgroundColor, applyTemplateToState etc.) SÓ ao
 * slide selecionado — os demais permanecem com a mesma referência de objeto,
 * garantindo que editar um slide nunca altere os outros (ETAPA 3).
 */
export function updateSelectedSlideState(
  state: CarouselEditorState,
  updater: (slideState: PostEditorState) => PostEditorState
): CarouselEditorState {
  const index = state.slides.findIndex((slide) => slide.id === state.selectedSlideId);
  if (index === -1) return state;

  const current = state.slides[index];
  const nextState = updater(current.state);
  if (Object.is(nextState, current.state)) return state;

  const slides = [...state.slides];
  slides[index] = { ...current, state: nextState };
  return { ...state, slides };
}

/**
 * Troca o formato do carrossel inteiro (ETAPA 5: "todos os slides do mesmo
 * carrossel deverão possuir o mesmo formato"). Reaplica `setFormat` a cada
 * slide individualmente, reaproveitando a mesma função pura do Criador de
 * Posts — os elementos se adaptam proporcionalmente porque o layout de
 * cada template já é definido em frações (0..1), não em pixels fixos.
 */
/**
 * "Aplicar a todos os slides": usa o mesmo template em todos os slides de
 * uma vez (mesma regra de applyTemplateToState slide a slide — textos
 * editados e imagens de cada slide são preservados).
 */
export function applyTemplateToAllSlides(
  state: CarouselEditorState,
  templateId: PostTemplateId
): CarouselEditorState {
  let changed = false;
  const slides = state.slides.map((slide) => {
    const next = applyTemplateToState(slide.state, templateId);
    if (Object.is(next, slide.state)) return slide;
    changed = true;
    return { ...slide, state: next };
  });
  return changed ? { ...state, slides } : state;
}

export function setCarouselFormat(
  state: CarouselEditorState,
  formatId: CarouselFormatId
): CarouselEditorState {
  if (formatId === state.formatId) return state;
  return {
    ...state,
    formatId,
    slides: state.slides.map((slide) => ({ ...slide, state: setPostFormat(slide.state, formatId) })),
  };
}

/**
 * Clona a imagem de fundo de um slide para uma URL própria e independente
 * (ETAPA 3: "não revogue um recurso enquanto outro slide ainda estiver
 * utilizando esse arquivo"). Em vez de fazer contagem de referências,
 * evitamos o compartilhamento de URL entre slides na origem: duplicar
 * sempre cria um Blob/URL novo a partir do mesmo arquivo, então cada slide
 * é sempre dono exclusivo da própria URL e pode revogá-la livremente ao
 * trocar ou remover a imagem, sem nunca afetar outro slide.
 */
export async function cloneBackgroundImage(image: BackgroundImageState): Promise<BackgroundImageState> {
  if (!image.url) return image;

  try {
    const response = await fetch(image.url);
    const blob = await response.blob();
    const clonedUrl = URL.createObjectURL(blob);
    return { ...image, url: clonedUrl };
  } catch {
    // Não foi possível clonar o arquivo (ex.: URL já revogada por algum
    // motivo externo) — duplicamos o slide sem a imagem em vez de arriscar
    // duas referências para o mesmo recurso.
    return {
      url: null,
      fileName: null,
      naturalWidth: null,
      naturalHeight: null,
      focusXFrac: image.focusXFrac,
      focusYFrac: image.focusYFrac,
      zoom: image.zoom ?? 1,
      fitMode: image.fitMode ?? "cover",
      overlayOpacity: image.overlayOpacity ?? null,
    };
  }
}

/** Clona o estado de um slide inteiro, incluindo os objetos de texto aninhados (ETAPA 3: "cópia independente, inclusive dos objetos aninhados"). */
export async function cloneSlideState(state: PostEditorState): Promise<PostEditorState> {
  const backgroundImage = await cloneBackgroundImage(state.backgroundImage);
  const texts = Object.fromEntries(
    Object.entries(state.texts).map(([slotId, text]) => [slotId, { ...text }])
  ) as PostEditorState["texts"];

  return { ...state, backgroundImage, texts };
}

/** Constrói o novo CarouselSlide pronto para `insertSlideAfter`, depois que `cloneSlideState` já resolveu (assíncrono) a clonagem da imagem. */
export function buildDuplicatedSlide(clonedState: PostEditorState): CarouselSlide {
  return { id: createSlideId(), order: 0, state: clonedState };
}

/** Libera a imagem de fundo de um slide (chamar ao remover um slide ou ao desmontar o editor) — sempre seguro porque cada slide é dono exclusivo da própria URL. */
export function releaseSlideImage(slide: CarouselSlide | undefined): void {
  if (!slide) return;
  revokeImageObjectUrl(slide.state.backgroundImage.url);
}

/** Usado só pelo botão "Começar novamente": libera a imagem de todos os slides de uma vez. */
export function releaseAllSlideImages(state: CarouselEditorState): void {
  state.slides.forEach((slide) => revokeImageObjectUrl(slide.state.backgroundImage.url));
}

/**
 * Constrói N cópias independentes de `seedImage` para popular os slides
 * de um carrossel (Carrossel automático — ETAPA 8/9), reaproveitando o
 * mesmo padrão "clona em vez de compartilhar URL" de `cloneBackgroundImage`
 * acima. A primeira posição da lista devolvida é sempre a própria
 * `seedImage`, sem clonar — preserva a URL original que o usuário acabou
 * de escolher em vez de descartá-la e criar N cópias novas.
 */
export async function buildBackgroundImagesForSlides(
  seedImage: BackgroundImageState,
  count: number
): Promise<BackgroundImageState[]> {
  const images: BackgroundImageState[] = [seedImage];
  for (let i = 1; i < count; i += 1) {
    images.push(await cloneBackgroundImage(seedImage));
  }
  return images;
}

/**
 * Constrói um CarouselEditorState inteiro a partir dos pedaços de texto já
 * calculados por `generateSlidesFromText`
 * (lib/instagram/carousel/generate-slides-from-text.ts) — um slide por
 * pedaço, todos com o template "frase motivacional"
 * (GENERATED_CAROUSEL_TEMPLATE_ID) e o texto no slot "heading"
 * (GENERATED_CAROUSEL_TEXT_SLOT), cada um com sua própria cópia
 * independente da imagem de fundo escolhida (ver
 * `buildBackgroundImagesForSlides`). Guarda `originalText` à parte — é o
 * que permite "Redistribuir texto" recalcular a divisão do zero sem
 * nunca reconstruir o texto original juntando de volta os slides.
 *
 * Atribui a imagem clonada diretamente ao campo `backgroundImage` do
 * estado do slide, em vez de usar `setBackgroundImage` de
 * editor-state.ts: aquela função foi desenhada para receber só os campos
 * vindos de um upload novo (url/fileName/naturalWidth/naturalHeight) e
 * reconstrói o resto a partir de um estado vazio — aqui a imagem já vem
 * pronta (clonada de uma escolhida pelo usuário), então atribuímos o
 * objeto inteiro como está, sem passar por essa reconstrução.
 */
export async function createCarouselStateFromTextChunks(
  chunks: string[],
  formatId: CarouselFormatId,
  seedImage: BackgroundImageState,
  originalText: string
): Promise<CarouselEditorState> {
  if (chunks.length === 0) {
    throw new Error("createCarouselStateFromTextChunks: nenhum slide para gerar (texto vazio).");
  }

  const images = await buildBackgroundImagesForSlides(seedImage, chunks.length);

  const slides = reindex(
    chunks.map((chunk, index) => {
      const slide = createCarouselSlide(formatId, GENERATED_CAROUSEL_TEMPLATE_ID);
      const stateWithImage: PostEditorState = { ...slide.state, backgroundImage: images[index] };
      const stateWithText = updateTextValue(stateWithImage, GENERATED_CAROUSEL_TEXT_SLOT, chunk);
      return { ...slide, state: stateWithText };
    })
  );

  return {
    formatId,
    slides,
    selectedSlideId: slides[0].id,
    originalText,
  };
}

/**
 * Item de entrada para `createCarouselStateFromImages`: uma imagem já
 * pronta (já validada e já transformada em BackgroundImageState por
 * `buildSeedBackgroundImage`, ver lib/instagram/carousel/auto-carousel.ts)
 * mais uma legenda opcional para o slide correspondente. `caption` vazia
 * ("") significa slide só-imagem, sem nenhum texto desenhado por cima.
 */
export interface CarouselImageSlideInput {
  image: BackgroundImageState;
  caption: string;
}

/**
 * Constrói um CarouselEditorState inteiro a partir de uma lista de imagens
 * já enviadas pelo usuário — o modo "Várias imagens" do Criador de
 * Carrosséis (uma imagem = um slide, cada slide dono exclusivo da própria
 * imagem). Ao contrário de `createCarouselStateFromTextChunks`, aqui NÃO
 * existe uma `seedImage` única clonada para todos os slides: cada entrada
 * de `inputs` já é a sua própria imagem independente (cada uma já veio de
 * um upload distinto do usuário), então não há nenhuma clonagem/
 * compartilhamento de URL entre slides — já nascem desacoplados.
 *
 * Reaproveita o mesmo template/slot de texto do Carrossel automático
 * (GENERATED_CAROUSEL_TEMPLATE_ID/GENERATED_CAROUSEL_TEXT_SLOT) por ser o
 * único cujos slots de badge/rodapé já nascem vazios — mas, diferente do
 * Carrossel automático, o slot de texto aqui é sempre sobrescrito
 * explicitamente com `caption` (mesmo quando `caption` é uma string
 * vazia), porque o valor padrão desse template
 * ("Feito é melhor que perfeito.") não pode aparecer sozinho em slides
 * pensados para serem só-imagem.
 *
 * `originalText` fica deliberadamente `undefined`: o painel "Carrossel
 * automático" do Estado 2 (Editar texto original / Redistribuir texto /
 * Trocar imagem de fundo) só faz sentido para um carrossel nascido de um
 * único bloco de texto dividido automaticamente — nenhuma dessas três
 * ações se aplica a um carrossel de imagens independentes, e deixar
 * `originalText` indefinido já esconde esse painel sem nenhum código
 * extra (ver a condição que o renderiza em CarouselEditorTool.tsx).
 */
export function createCarouselStateFromImages(
  inputs: CarouselImageSlideInput[],
  formatId: CarouselFormatId
): CarouselEditorState {
  if (inputs.length === 0) {
    throw new Error("createCarouselStateFromImages: nenhuma imagem para gerar slides.");
  }

  const slides = reindex(
    inputs.map(({ image, caption }) => {
      // Sem legenda → "Somente imagem": o slide é só a foto enviada, sem as
      // aspas decorativas nem o véu escuro do template de frase.
      const templateId = caption.trim() ? GENERATED_CAROUSEL_TEMPLATE_ID : IMAGE_ONLY_TEMPLATE_ID;
      const slide = createCarouselSlide(formatId, templateId);
      const stateWithImage: PostEditorState = { ...slide.state, backgroundImage: image };
      const stateWithText = updateTextValue(stateWithImage, GENERATED_CAROUSEL_TEXT_SLOT, caption);
      return { ...slide, state: stateWithText };
    })
  );

  return {
    formatId,
    slides,
    selectedSlideId: slides[0].id,
  };
}

/**
 * Ação "Trocar imagem de fundo" do Estado 2 (revisão): substitui a imagem
 * de fundo de TODOS os slides do carrossel por cópias independentes de
 * `seedImage` de uma só vez — mesmo padrão de clonagem de
 * `buildBackgroundImagesForSlides`, aplicado a um carrossel já existente
 * (gerado automaticamente ou montado manualmente) em vez de a uma lista de
 * textos nova. Como em `removeSlide`/`releaseSlideImage`, revogar as URLs
 * antigas das imagens substituídas é responsabilidade de quem chama esta
 * função — cada slide continua dono exclusivo da própria URL.
 */
export async function applyImageToAllSlides(
  state: CarouselEditorState,
  seedImage: BackgroundImageState
): Promise<CarouselEditorState> {
  const images = await buildBackgroundImagesForSlides(seedImage, state.slides.length);
  return {
    ...state,
    slides: state.slides.map((slide, index) => ({
      ...slide,
      state: { ...slide.state, backgroundImage: images[index] },
    })),
  };
}

/** Slide "limpo", usado por `clearBackgroundImage` reexportado para conveniência dos componentes de carrossel. */
export { clearBackgroundImage };
