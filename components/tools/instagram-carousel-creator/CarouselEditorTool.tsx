"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { ChevronDown, RotateCcw, Redo2, Undo2 } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/Button";
import { getFormatById } from "@/lib/instagram/formats";
import type { PostTemplateId, TextSlotId } from "@/lib/instagram/templates";
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
  buildDuplicatedSlide,
  canAddSlide,
  canRemoveSlide,
  cloneSlideState,
  createInitialCarouselState,
  getSelectedSlide,
  insertSlideAfter,
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
import { buildSlidesFromPreset, getCarouselPresetById } from "@/lib/instagram/carousel/carousel-presets";
import { useEditorHistory } from "@/components/tools/instagram-post-creator/useEditorHistory";
import { EditorPreviewCanvas } from "@/components/tools/instagram-post-creator/EditorPreviewCanvas";
import { TextControls } from "@/components/tools/instagram-post-creator/TextControls";
import { BackgroundControls } from "@/components/tools/instagram-post-creator/BackgroundControls";
import { SlidesPanel } from "./SlidesPanel";
import { CarouselStructureControls } from "./CarouselStructureControls";
import { CarouselExportPanel } from "./CarouselExportPanel";

/**
 * Componente principal do Criador de Carrosséis (Fase 2, ETAPA 2). Reutiliza
 * praticamente todo o Criador de Posts — a única coisa nova de verdade é o
 * "porta-slides" ao redor dele (lib/instagram/carousel/carousel-state.ts):
 * cada slide é um `PostEditorState` completo, e toda a edição de texto,
 * cor e imagem passa pelas mesmíssimas funções puras do editor original,
 * só que aplicadas apenas ao slide selecionado
 * (`updateSelectedSlideState`). Tudo roda 100% no navegador.
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
  }

  // Sugestão de assunto para o Gerador de Legendas (ETAPA 12), a partir do
  // primeiro título não vazio entre os slides — nunca dado pessoal, apenas
  // o texto que o próprio usuário já digitou nesta ferramenta.
  const suggestedSubject = state.slides
    .map((slide) => slide.state.texts.heading.value.trim())
    .find((value) => value.length > 0);
  const captionHref = suggestedSubject
    ? `/instagram/legendas?assunto=${encodeURIComponent(suggestedSubject)}`
    : "/instagram/legendas";

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[20rem_minmax(0,1fr)_19rem] lg:items-start">
      {/* Área B — Visualização do slide selecionado: em destaque no celular, ao centro no desktop. */}
      <div className="order-1 lg:order-2 lg:sticky lg:top-20">
        <p className="mb-2 text-center text-sm font-medium text-zinc-600 lg:text-left">
          Editando: Slide {selectedIndex + 1} de {state.slides.length}
        </p>
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
