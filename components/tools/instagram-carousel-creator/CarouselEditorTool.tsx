"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ComponentType } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, Redo2, Undo2 } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { getFormatById } from "@/lib/instagram/formats";
import type { PostTemplateId, TextSlotId } from "@/lib/instagram/templates";
import {
  ACCEPTED_IMAGE_INPUT_ACCEPT,
  createImageObjectUrl,
  loadImageElement,
  revokeImageObjectUrl,
  validateImageFile,
} from "@/lib/instagram/image-utils";
import {
  applyColorComboToState,
  applyTemplateToState,
  clearBackgroundImage,
  setBackgroundColor,
  setBackgroundImage,
  setBackgroundImageFocus,
  setBadgeColors,
  updateTextOffset,
  updateTextStyle,
  updateTextValue,
  type BackgroundImageState,
  type TextLayerState,
} from "@/lib/instagram/editor-state";
import {
  addSlide,
  applyImageToAllSlides,
  buildDuplicatedSlide,
  canAddSlide,
  canRemoveSlide,
  cloneBackgroundImage,
  cloneSlideState,
  createCarouselStateFromImages,
  applyTemplateToAllSlides,
  createInitialCarouselState,
  GENERATED_CAROUSEL_TEXT_SLOT,
  getSelectedSlide,
  insertSlideAfter,
  MAX_CAROUSEL_PUBLISH_ITEMS,
  MAX_CAROUSEL_SLIDES,
  moveSlideDown,
  moveSlideUp,
  releaseAllSlideImages,
  releaseSlideImage,
  removeSlide,
  reorderSlides,
  selectSlide,
  setCarouselFormat,
  updateSelectedSlideState,
  type CarouselEditorState,
  type CarouselFormatId,
  type CarouselSlide,
} from "@/lib/instagram/carousel/carousel-state";
import { buildCarouselFromPastedText, buildSeedBackgroundImage, type AutoCarouselResult } from "@/lib/instagram/carousel/auto-carousel";
import { buildSlidesFromPreset, getCarouselPresetById } from "@/lib/instagram/carousel/carousel-presets";
import { useEditorHistory } from "@/components/tools/instagram-post-creator/useEditorHistory";
import { EditorPreviewCanvas } from "@/components/tools/instagram-post-creator/EditorPreviewCanvas";
import { TextControls } from "@/components/tools/instagram-post-creator/TextControls";
import { BackgroundControls } from "@/components/tools/instagram-post-creator/BackgroundControls";
import { SlidesPanel } from "./SlidesPanel";
import { CarouselStructureControls } from "./CarouselStructureControls";
import { CarouselExportPanel } from "./CarouselExportPanel";
import { CarouselQuickCreate, type CarouselQuickCreateImage } from "./CarouselQuickCreate";

/**
 * Componente principal do Criador de Carrosséis (Fase 2, ETAPA 2; Carrossel
 * automático, ETAPA 8/9). Reutiliza praticamente todo o Criador de Posts —
 * cada slide é um `PostEditorState` completo — e toda a edição de texto,
 * cor e imagem passa pelas mesmíssimas funções puras do editor original,
 * só que aplicadas apenas ao slide selecionado (`updateSelectedSlideState`).
 * Tudo roda 100% no navegador.
 *
 * Dois estados de tela, não dois componentes separados por rota: "Criação"
 * (CarouselQuickCreate — imagem + texto completo + "Gerar carrossel", sem
 * nenhum outro controle) e "Revisão" (o editor completo de sempre, com o
 * "Editando: Slide X de Y" e todos os controles). Começa em "Criação" só
 * quando não existe `initialState` (primeira visita) — um carrossel
 * restaurado de um rascunho (ver PublicCarouselCreator.tsx) sempre chega
 * pronto na "Revisão", exatamente como antes desta mudança.
 */
export interface CarouselPublishPanelSlotProps {
  slides: CarouselSlide[];
  formatId: CarouselFormatId;
}

export interface CarouselEditorToolProps {
  /**
   * Slot opcional de publicação real — só preenchido pela área autenticada
   * do calendário editorial (ver AuthenticatedCarouselComposer.tsx e
   * app/instagram/painel/calendario/novo-carrossel/page.tsx). Componente
   * (não uma função invocada inline) para evitar o aviso do eslint
   * react-hooks/refs e ficar consistente com o mesmo padrão já usado em
   * PostEditorTool.tsx. Ausente por padrão: a ferramenta pública
   * (/instagram/carrossel) nunca recebe nem renderiza nada aqui.
   */
  publishPanel?: ComponentType<CarouselPublishPanelSlotProps>;
  /** Estado inicial (ex.: carrossel restaurado depois do login/conexão com o Instagram). */
  initialState?: CarouselEditorState;
  /** Notificado a cada mudança (ex.: guardar rascunho local antes de sair para o login). */
  onStateChange?: (state: CarouselEditorState) => void;
}

interface OverflowNotice {
  /** "hardCap": o próprio texto não coube nem nos MAX_CAROUSEL_SLIDES do editor. "publishLimit": coube no editor, mas passa do limite de publicação do Instagram. */
  kind: "hardCap" | "publishLimit";
  slideCount: number;
  /** Texto que ainda não virou slide nenhum (kind "hardCap") ou texto dos slides além do limite de publicação (kind "publishLimit") — nunca descartado, sempre disponível para "Criar outro carrossel com o restante". */
  leftoverText: string;
}

function buildOverflowNotice(result: AutoCarouselResult): OverflowNotice | null {
  if (result.overflowText) {
    return { kind: "hardCap", slideCount: result.state.slides.length, leftoverText: result.overflowText };
  }
  if (result.state.slides.length > MAX_CAROUSEL_PUBLISH_ITEMS) {
    const leftoverText = result.state.slides
      .slice(MAX_CAROUSEL_PUBLISH_ITEMS)
      .map((slide) => slide.state.texts[GENERATED_CAROUSEL_TEXT_SLOT].value)
      .join("\n\n");
    return { kind: "publishLimit", slideCount: result.state.slides.length, leftoverText };
  }
  return null;
}

export function CarouselEditorTool({
  publishPanel: PublishPanelSlot,
  initialState,
  onStateChange,
}: CarouselEditorToolProps = {}) {
  const {
    state,
    commit,
    commitDebounced,
    setStateWithoutHistory,
    flushPending,
    undo,
    redo,
    resetHistory,
    canUndo,
    canRedo,
  } = useEditorHistory<CarouselEditorState>(initialState ?? createInitialCarouselState());

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Estado 1 ("Criação") por padrão só na primeira visita — um carrossel
  // restaurado de rascunho (initialState presente) sempre abre direto no
  // Estado 2 ("Revisão"), como antes desta mudança.
  const [mode, setMode] = useState<"create" | "review">(initialState ? "review" : "create");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [overflowNotice, setOverflowNotice] = useState<OverflowNotice | null>(null);
  // Só usado por "Criar outro carrossel com o restante" (ETAPA 9): sobrescreve o texto herdado de state.originalText UMA vez, ao voltar para o Estado 1 com um carrossel novo/vazio.
  const [pendingCreateText, setPendingCreateText] = useState<string | null>(null);
  const [isChangingImage, setIsChangingImage] = useState(false);
  const changeImageInputRef = useRef<HTMLInputElement>(null);

  // Libera a imagem de TODOS os slides ao desmontar o editor (ex.: usuário
  // sai da página) — cada slide é dono exclusivo da própria URL (ver
  // comentário em cloneBackgroundImage), então isto nunca afeta nada fora
  // deste editor.
  useEffect(() => {
    return () => releaseAllSlideImages(stateRef.current);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isEditable) return;

      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((event.ctrlKey || event.metaKey) && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const selectedSlide = getSelectedSlide(state);
  const selectedIndex = state.slides.findIndex((slide) => slide.id === selectedSlide.id);
  const format = getFormatById(state.formatId);

  const handleFormatChange = useCallback(
    (formatId: CarouselFormatId) => commit((prev) => setCarouselFormat(prev, formatId)),
    [commit]
  );

  const handleTemplateChange = useCallback(
    (templateId: PostTemplateId) =>
      commit((prev) => updateSelectedSlideState(prev, (s) => applyTemplateToState(s, templateId))),
    [commit]
  );

  const handleApplyTemplateToAll = useCallback(
    (templateId: PostTemplateId) => commit((prev) => applyTemplateToAllSlides(prev, templateId)),
    [commit]
  );

  const handleTextValueChange = useCallback(
    (slotId: TextSlotId, value: string) =>
      commitDebounced((prev) => updateSelectedSlideState(prev, (s) => updateTextValue(s, slotId, value))),
    [commitDebounced]
  );

  const handleTextStyleChange = useCallback(
    (slotId: TextSlotId, patch: Partial<Omit<TextLayerState, "value">>) =>
      commit((prev) => updateSelectedSlideState(prev, (s) => updateTextStyle(s, slotId, patch))),
    [commit]
  );

  const handleColorComboChange = useCallback(
    (comboId: string) =>
      commit((prev) => updateSelectedSlideState(prev, (s) => applyColorComboToState(s, comboId))),
    [commit]
  );

  const handleBackgroundColorChange = useCallback(
    (color: string) => commit((prev) => updateSelectedSlideState(prev, (s) => setBackgroundColor(s, color))),
    [commit]
  );

  const handleBadgeColorsChange = useCallback(
    (background: string, text: string) =>
      commit((prev) => updateSelectedSlideState(prev, (s) => setBadgeColors(s, background, text))),
    [commit]
  );

  const handleImageChange = useCallback(
    (image: Pick<BackgroundImageState, "url" | "fileName" | "naturalWidth" | "naturalHeight">) =>
      commit((prev) => updateSelectedSlideState(prev, (s) => setBackgroundImage(s, image))),
    [commit]
  );

  const handleImageRemoved = useCallback(
    () => commit((prev) => updateSelectedSlideState(prev, (s) => clearBackgroundImage(s))),
    [commit]
  );

  const handleImageFocusChange = useCallback(
    (focusXFrac: number, focusYFrac: number) =>
      commitDebounced((prev) =>
        updateSelectedSlideState(prev, (s) => setBackgroundImageFocus(s, focusXFrac, focusYFrac))
      ),
    [commitDebounced]
  );

  const handleDragMove = useCallback(
    (slotId: TextSlotId, offsetXFrac: number, offsetYFrac: number) =>
      commitDebounced((prev) => updateSelectedSlideState(prev, (s) => updateTextOffset(s, slotId, offsetXFrac, offsetYFrac))),
    [commitDebounced]
  );

  const handleSelectSlide = useCallback(
    (slideId: string) => setStateWithoutHistory((prev) => selectSlide(prev, slideId)),
    [setStateWithoutHistory]
  );

  const handlePreviousSlide = useCallback(() => {
    const index = stateRef.current.slides.findIndex((slide) => slide.id === stateRef.current.selectedSlideId);
    if (index <= 0) return;
    handleSelectSlide(stateRef.current.slides[index - 1].id);
  }, [handleSelectSlide]);

  const handleNextSlide = useCallback(() => {
    const index = stateRef.current.slides.findIndex((slide) => slide.id === stateRef.current.selectedSlideId);
    if (index === -1 || index >= stateRef.current.slides.length - 1) return;
    handleSelectSlide(stateRef.current.slides[index + 1].id);
  }, [handleSelectSlide]);

  const handleAddSlide = useCallback(() => commit((prev) => addSlide(prev)), [commit]);

  const handleDuplicateSlide = useCallback(
    async (slideId: string) => {
      const slide = stateRef.current.slides.find((item) => item.id === slideId);
      if (!slide || isDuplicating || !canAddSlide(stateRef.current)) return;

      setIsDuplicating(true);
      try {
        const clonedState = await cloneSlideState(slide.state);
        commit((prev) => insertSlideAfter(prev, slideId, buildDuplicatedSlide(clonedState)));
      } finally {
        setIsDuplicating(false);
      }
    },
    [commit, isDuplicating]
  );

  const handleRemoveSlide = useCallback(
    (slideId: string) => {
      if (!canRemoveSlide(stateRef.current)) return;
      const slide = stateRef.current.slides.find((item) => item.id === slideId);
      releaseSlideImage(slide);
      commit((prev) => removeSlide(prev, slideId));
    },
    [commit]
  );

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => commit((prev) => reorderSlides(prev, fromIndex, toIndex)),
    [commit]
  );

  const handleMoveUp = useCallback((slideId: string) => commit((prev) => moveSlideUp(prev, slideId)), [commit]);
  const handleMoveDown = useCallback(
    (slideId: string) => commit((prev) => moveSlideDown(prev, slideId)),
    [commit]
  );

  const handleApplyPreset = useCallback(
    (presetId: string) => {
      const preset = getCarouselPresetById(presetId);
      if (!preset) return;

      const confirmed = window.confirm(
        `Aplicar o modelo "${preset.name}" substitui todos os ${stateRef.current.slides.length} slides atuais por uma nova sequência de slides prontos. Deseja continuar?`
      );
      if (!confirmed) return;

      releaseAllSlideImages(stateRef.current);
      const slides = buildSlidesFromPreset(preset, stateRef.current.formatId);
      resetHistory({ formatId: stateRef.current.formatId, slides, selectedSlideId: slides[0].id });
    },
    [resetHistory]
  );

  function handleReset() {
    const confirmed = window.confirm(
      "Tem certeza que deseja começar novamente? Todas as alterações feitas neste carrossel serão perdidas."
    );
    if (!confirmed) return;
    releaseAllSlideImages(stateRef.current);
    resetHistory(createInitialCarouselState(stateRef.current.formatId));
    setOverflowNotice(null);
    setGenerateError(null);
    setPendingCreateText(null);
    setMode("create");
  }

  // Carrossel automático (Fase 2, ETAPA 8/9): "Gerar carrossel" (Estado 1
  // → Estado 2) e "Redistribuir texto" (Estado 2, no lugar) passam pelo
  // mesmo caminho — ver buildCarouselFromPastedText em auto-carousel.ts.
  const runAutoGenerate = useCallback(
    async (text: string, seedImage: BackgroundImageState) => {
      setIsGenerating(true);
      setGenerateError(null);
      try {
        const result = await buildCarouselFromPastedText({
          text,
          seedImage,
          formatId: stateRef.current.formatId,
        });
        // Nenhuma imagem do carrossel anterior é mais usada a partir daqui.
        // Sempre seguro: `seedImage` é sempre uma URL nova e exclusiva (de
        // um upload novo, ou já clonada por quem chamou esta função) —
        // nunca a mesma URL que um slide antigo ainda está usando.
        releaseAllSlideImages(stateRef.current);
        resetHistory(result.state);
        setOverflowNotice(buildOverflowNotice(result));
        setPendingCreateText(null);
        setMode("review");
      } catch (err) {
        setGenerateError(
          err instanceof Error ? err.message : "Não foi possível gerar o carrossel agora. Tente novamente."
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [resetHistory]
  );

  const handleGenerate = useCallback(
    async (text: string, image: CarouselQuickCreateImage | null) => {
      if (image) {
        await runAutoGenerate(text, buildSeedBackgroundImage(image));
        return;
      }

      // Usuário não trocou a imagem mostrada (herdada do carrossel atual,
      // ex.: veio de "Editar texto original") — clona em vez de reaproveitar
      // a mesma URL: cada estado precisa continuar dono exclusivo da
      // própria imagem (ver cloneBackgroundImage em carousel-state.ts).
      const currentImage = stateRef.current.slides[0]?.state.backgroundImage;
      if (!currentImage?.url) {
        setGenerateError("Escolha uma imagem antes de gerar o carrossel.");
        return;
      }
      setIsGenerating(true);
      try {
        const clonedSeed = await cloneBackgroundImage(currentImage);
        await runAutoGenerate(text, clonedSeed);
      } finally {
        setIsGenerating(false);
      }
    },
    [runAutoGenerate]
  );

  // Modo "Várias imagens" (novo): uma imagem por slide, sem nenhuma imagem
  // global/compartilhada — cada BackgroundImageState já vem de um upload
  // independente (buildSeedBackgroundImage), então createCarouselStateFromImages
  // não precisa clonar nada (ao contrário de runAutoGenerate/buildCarouselFromPastedText,
  // que clonam UMA imagem semente para todos os slides).
  const runGenerateFromImages = useCallback(
    (images: CarouselQuickCreateImage[]) => {
      if (images.length === 0) {
        setGenerateError("Adicione pelo menos uma imagem antes de gerar o carrossel.");
        return;
      }
      setGenerateError(null);
      try {
        const state = createCarouselStateFromImages(
          images.map((image) => ({ image: buildSeedBackgroundImage(image), caption: "" })),
          stateRef.current.formatId
        );
        // Nenhuma imagem do carrossel anterior é mais usada a partir daqui
        // (mesmo raciocínio de runAutoGenerate: as novas imagens já são
        // uploads novos e exclusivos, nunca URLs que um slide antigo ainda
        // usa).
        releaseAllSlideImages(stateRef.current);
        resetHistory(state);
        setOverflowNotice(null);
        setPendingCreateText(null);
        setMode("review");
      } catch (err) {
        setGenerateError(
          err instanceof Error ? err.message : "Não foi possível gerar o carrossel agora. Tente novamente."
        );
      }
    },
    [resetHistory]
  );

  const handleEditOriginalText = useCallback(() => {
    setGenerateError(null);
    setOverflowNotice(null);
    setMode("create");
  }, []);

  const handleRedistributeText = useCallback(async () => {
    const current = stateRef.current;
    if (current.originalText === undefined) return;
    const currentImage = current.slides[0]?.state.backgroundImage;
    if (!currentImage?.url) {
      setGenerateError("Este carrossel não tem imagem de fundo para redistribuir o texto.");
      return;
    }
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const clonedSeed = await cloneBackgroundImage(currentImage);
      await runAutoGenerate(current.originalText, clonedSeed);
    } finally {
      setIsGenerating(false);
    }
  }, [runAutoGenerate]);

  const handleChangeBackgroundImageFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = "";
      if (!file) return;

      const validation = validateImageFile(file);
      if (!validation.valid) {
        setGenerateError(validation.error ?? "Não foi possível usar essa imagem.");
        return;
      }

      setIsChangingImage(true);
      setGenerateError(null);
      const url = createImageObjectUrl(file);
      try {
        const loaded = await loadImageElement(url);
        const seedImage = buildSeedBackgroundImage({
          url,
          fileName: file.name,
          naturalWidth: loaded.naturalWidth,
          naturalHeight: loaded.naturalHeight,
        });
        const previous = stateRef.current;
        const next = await applyImageToAllSlides(previous, seedImage);
        releaseAllSlideImages(previous);
        commit(() => next);
      } catch {
        revokeImageObjectUrl(url);
        setGenerateError("Não foi possível trocar a imagem agora. Tente outro arquivo.");
      } finally {
        setIsChangingImage(false);
      }
    },
    [commit]
  );

  const handleCreateAnotherWithLeftover = useCallback(
    (leftoverText: string) => {
      const confirmed = window.confirm(
        "Isso começa um carrossel novo com o texto que sobrou, e libera as imagens do carrossel atual. Deseja continuar?"
      );
      if (!confirmed) return;
      releaseAllSlideImages(stateRef.current);
      resetHistory(createInitialCarouselState(stateRef.current.formatId));
      setPendingCreateText(leftoverText);
      setOverflowNotice(null);
      setGenerateError(null);
      setMode("create");
    },
    [resetHistory]
  );

  // Sugestão de assunto para o Gerador de Legendas (ETAPA 12), a partir do
  // primeiro título não vazio entre os slides — nunca dado pessoal, apenas
  // o texto que o próprio usuário já digitou nesta ferramenta.
  const suggestedSubject = state.slides
    .map((slide) => slide.state.texts.heading.value.trim())
    .find((value) => value.length > 0);
  const captionHref = suggestedSubject
    ? `/instagram/legendas?assunto=${encodeURIComponent(suggestedSubject)}`
    : "/instagram/legendas";

  if (mode === "create") {
    const currentImage = state.slides[0]?.state.backgroundImage;
    const initialImagePreview: CarouselQuickCreateImage | null = currentImage?.url
      ? {
          url: currentImage.url,
          fileName: currentImage.fileName,
          naturalWidth: currentImage.naturalWidth,
          naturalHeight: currentImage.naturalHeight,
        }
      : null;

    return (
      <CarouselQuickCreate
        formatId={state.formatId}
        onFormatChange={handleFormatChange}
        initialText={pendingCreateText ?? state.originalText ?? ""}
        initialImagePreview={initialImagePreview}
        busy={isGenerating}
        error={generateError}
        onGenerate={(text, image) => void handleGenerate(text, image)}
        onGenerateFromImages={runGenerateFromImages}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[20rem_minmax(0,1fr)_19rem] lg:items-start">
      {overflowNotice ? (
        <div className="order-0 rounded-lg border border-amber-300 bg-amber-50 p-4 lg:col-span-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" aria-hidden />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-amber-900">
                {overflowNotice.kind === "hardCap"
                  ? `Seu conteúdo gerou mais slides do que o editor comporta (o máximo é ${MAX_CAROUSEL_SLIDES}). O texto que sobrou ainda não virou slide nenhum — nada foi perdido.`
                  : `Seu conteúdo gerou ${overflowNotice.slideCount} slides. O Instagram permite até ${MAX_CAROUSEL_PUBLISH_ITEMS} imagens por carrossel.`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={handleEditOriginalText} className="min-h-9 px-3 py-1.5 text-xs">
                  Reduzir conteúdo
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleCreateAnotherWithLeftover(overflowNotice.leftoverText)}
                  className="min-h-9 px-3 py-1.5 text-xs"
                >
                  Criar outro carrossel com o restante
                </Button>
                <Button type="button" variant="ghost" onClick={() => setOverflowNotice(null)} className="min-h-9 px-3 py-1.5 text-xs">
                  Dispensar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Área B — Visualização do slide selecionado: em destaque no celular, ao centro no desktop. */}
      <div className="order-1 lg:order-2 lg:sticky lg:top-20">
        <div className="mb-2 flex items-center justify-center gap-2 lg:justify-start">
          <Button
            type="button"
            variant="ghost"
            onClick={handlePreviousSlide}
            disabled={selectedIndex <= 0}
            aria-label="Slide anterior"
            className="min-h-8 px-2"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <p className="text-center text-sm font-medium text-zinc-600">
            Editando: Slide {selectedIndex + 1} de {state.slides.length}
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={handleNextSlide}
            disabled={selectedIndex >= state.slides.length - 1}
            aria-label="Próximo slide"
            className="min-h-8 px-2"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <EditorPreviewCanvas
          format={format}
          state={selectedSlide.state}
          canvasRef={canvasRef}
          onDragMove={handleDragMove}
          onDragEnd={flushPending}
        />
      </div>

      {/* Ações rápidas: desfazer/refazer/reiniciar, exportação em ZIP e link para o Gerador de Legendas. */}
      <div className="order-2 space-y-4 lg:order-3 lg:sticky lg:top-20">
        <div className="flex items-center justify-center gap-2 lg:justify-start">
          <Button type="button" variant="secondary" onClick={undo} disabled={!canUndo} aria-label="Desfazer">
            <Undo2 className="h-4 w-4" aria-hidden />
            Desfazer
          </Button>
          <Button type="button" variant="secondary" onClick={redo} disabled={!canRedo} aria-label="Refazer">
            <Redo2 className="h-4 w-4" aria-hidden />
            Refazer
          </Button>
        </div>

        {state.originalText !== undefined ? (
          <div className="space-y-2 rounded-lg border border-zinc-200 p-4">
            <p className="text-sm font-medium text-zinc-700">Carrossel automático</p>
            <div className="flex flex-col gap-2">
              <Button type="button" variant="secondary" onClick={handleEditOriginalText} className="w-full justify-center">
                Editar texto original
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleRedistributeText()}
                disabled={isGenerating}
                className="w-full justify-center"
              >
                {isGenerating ? "Redistribuindo..." : "Redistribuir texto"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => changeImageInputRef.current?.click()}
                disabled={isChangingImage}
                className="w-full justify-center"
              >
                {isChangingImage ? "Trocando imagem..." : "Trocar imagem de fundo"}
              </Button>
              <input
                ref={changeImageInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_INPUT_ACCEPT}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                data-testid="carousel-change-background-image"
                onChange={(event) => void handleChangeBackgroundImageFile(event)}
              />
            </div>
            {generateError ? (
              <p role="alert" className="text-sm text-red-600">
                {generateError}
              </p>
            ) : null}
          </div>
        ) : null}

        <CarouselExportPanel slides={state.slides} formatId={state.formatId} />

        {PublishPanelSlot ? <PublishPanelSlot slides={state.slides} formatId={state.formatId} /> : null}

        <LinkButton href={captionHref} variant="secondary" className="w-full justify-center">
          Criar uma legenda para este carrossel
        </LinkButton>

        <Button type="button" variant="ghost" onClick={handleReset} className="w-full justify-center">
          <RotateCcw className="h-4 w-4" aria-hidden />
          Começar novamente
        </Button>
      </div>

      {/* Área A — Painel de slides + configurações do slide selecionado. */}
      <div className="order-3 space-y-4 lg:order-1">
        <div className="rounded-lg border border-zinc-200 p-4">
          <SlidesPanel
            slides={state.slides}
            format={format}
            selectedSlideId={selectedSlide.id}
            canAdd={canAddSlide(state)}
            canRemove={canRemoveSlide(state)}
            isBusy={isDuplicating}
            maxSlides={MAX_CAROUSEL_SLIDES}
            onSelect={handleSelectSlide}
            onAdd={handleAddSlide}
            onDuplicate={handleDuplicateSlide}
            onRemove={handleRemoveSlide}
            onReorder={handleReorder}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
          />
        </div>

        <details className="group rounded-lg border border-zinc-200 lg:border-0" open>
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 lg:bg-transparent lg:px-0 lg:py-0 lg:text-base">
            Formato, template e modelos
            <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180 lg:hidden" aria-hidden />
          </summary>
          <div className="border-t border-zinc-200 p-4 lg:!block lg:border-0 lg:p-0 lg:pt-3">
            <CarouselStructureControls
              formatId={state.formatId}
              templateId={selectedSlide.state.templateId}
              onFormatChange={handleFormatChange}
              onTemplateChange={handleTemplateChange}
              onApplyTemplateToAll={handleApplyTemplateToAll}
              onApplyPreset={handleApplyPreset}
            />
          </div>
        </details>

        <details className="group rounded-lg border border-zinc-200 lg:border-0" open>
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 lg:bg-transparent lg:px-0 lg:py-0 lg:text-base">
            Textos do slide {selectedIndex + 1}
            <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180 lg:hidden" aria-hidden />
          </summary>
          <div className="border-t border-zinc-200 p-4 lg:!block lg:border-0 lg:p-0 lg:pt-3">
            <TextControls
              state={selectedSlide.state}
              onValueChange={handleTextValueChange}
              onStyleChange={handleTextStyleChange}
            />
          </div>
        </details>

        <details className="group rounded-lg border border-zinc-200 lg:border-0" open>
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 lg:bg-transparent lg:px-0 lg:py-0 lg:text-base">
            Cores e imagem do slide {selectedIndex + 1}
            <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180 lg:hidden" aria-hidden />
          </summary>
          <div className="border-t border-zinc-200 p-4 lg:!block lg:border-0 lg:p-0 lg:pt-3">
            <BackgroundControls
              state={selectedSlide.state}
              onColorComboChange={handleColorComboChange}
              onBackgroundColorChange={handleBackgroundColorChange}
              onBadgeColorsChange={handleBadgeColorsChange}
              onImageChange={handleImageChange}
              onImageRemoved={handleImageRemoved}
              onImageFocusChange={handleImageFocusChange}
            />
          </div>
        </details>

        <p className="text-center text-xs text-zinc-500 lg:text-left">
          Prefere editar um post só?{" "}
          <Link href="/instagram/criar-post" className="font-medium text-teal-800 hover:underline">
            Use o Criador de Posts
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
