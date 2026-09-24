"use client";

import { useCallback, useEffect, useRef, type ComponentType, type RefObject } from "react";
import { ChevronDown, RotateCcw, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getFormatById, type PostFormat, type PostFormatId } from "@/lib/instagram/formats";
import { type PostTemplateId, type TextSlotId } from "@/lib/instagram/templates";
import {
  applyColorComboToState,
  applyTemplateToState,
  clearBackgroundImage,
  createInitialEditorState,
  setBackgroundColor,
  setBackgroundImage,
  setBackgroundImageFitMode,
  setBackgroundImageFocus,
  setBackgroundImageZoom,
  setBadgeColors,
  setFormat,
  updateTextOffset,
  updateTextStyle,
  updateTextValue,
  type BackgroundImageState,
  type PostEditorState,
  type TextLayerState,
} from "@/lib/instagram/editor-state";
import { revokeImageObjectUrl } from "@/lib/instagram/image-utils";
import { useEditorHistory } from "./useEditorHistory";
import { EditorPreviewCanvas } from "./EditorPreviewCanvas";
import { StructureControls } from "./StructureControls";
import { TextControls } from "./TextControls";
import { BackgroundControls } from "./BackgroundControls";
import { ExportPanel } from "./ExportPanel";

export interface PublishPanelSlotProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  format: PostFormat;
  /** Estado atual do editor (template, textos, imagem) — usado para salvar a arte e reabri-la depois. */
  state: PostEditorState;
}

export interface PostEditorToolProps {
  /**
   * Componente opcional renderizado logo após o painel de exportação
   * local (PNG/JPG), recebendo `canvasRef`/`format` como props — mesmo
   * padrão já usado por `ExportPanel` (nunca uma função chamada
   * diretamente durante a renderização: o hook lint `react-hooks/refs`
   * não permite ler um ref passado como argumento de função no corpo do
   * render, só como prop de componente). Usado pelo calendário editorial
   * (área autenticada, ver AuthenticatedPostComposer) para acrescentar um
   * "Agendar/Publicar no Instagram" sem tocar na ferramenta pública e sem
   * login (/instagram/criar-post) — que continua exatamente como era,
   * sem essa prop, e sem nenhuma ação que exija conta conectada.
   */
  publishPanel?: ComponentType<PublishPanelSlotProps>;
  /** Estado inicial (ex.: reabrir um Post Viral salvo ou um rascunho restaurado). */
  initialState?: PostEditorState;
  /** Notificado a cada mudança do estado (ex.: guardar rascunho local antes do login). */
  onStateChange?: (state: PostEditorState) => void;
}

/**
 * Componente principal do Criador de Posts para Instagram (ETAPA 2). Todo o
 * processamento — desenho, textos, imagens e exportação — acontece 100% no
 * navegador do usuário: nada é enviado a um servidor, e não é preciso
 * criar conta nem fazer login. `publishPanel` é a única exceção (ver
 * PostEditorToolProps) — opcional, usado só pela área autenticada.
 */
export function PostEditorTool({
  publishPanel: PublishPanelSlot,
  initialState,
  onStateChange,
}: PostEditorToolProps = {}) {
  const {
    state,
    commit,
    commitDebounced,
    flushPending,
    undo,
    redo,
    resetHistory,
    canUndo,
    canRedo,
  } = useEditorHistory<PostEditorState>(initialState ?? createInitialEditorState());

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const backgroundImageUrlRef = useRef<string | null>(null);

  // Mantém a ref com a URL mais recente da imagem (para o cleanup de
  // desmontagem abaixo poder liberá-la) e libera a URL anterior quando ela
  // deixa de ser usada — nunca durante a renderização (ETAPA 5.2).
  useEffect(() => {
    backgroundImageUrlRef.current = state.backgroundImage.url;
  }, [state.backgroundImage.url]);

  useEffect(() => {
    return () => revokeImageObjectUrl(backgroundImageUrlRef.current);
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

  const format = getFormatById(state.formatId);

  const handleFormatChange = useCallback(
    (formatId: PostFormatId) => commit((prev) => setFormat(prev, formatId)),
    [commit]
  );

  const handleTemplateChange = useCallback(
    (templateId: PostTemplateId) => commit((prev) => applyTemplateToState(prev, templateId)),
    [commit]
  );

  const handleTextValueChange = useCallback(
    (slotId: TextSlotId, value: string) => commitDebounced((prev) => updateTextValue(prev, slotId, value)),
    [commitDebounced]
  );

  const handleTextStyleChange = useCallback(
    (slotId: TextSlotId, patch: Partial<Omit<TextLayerState, "value">>) =>
      commit((prev) => updateTextStyle(prev, slotId, patch)),
    [commit]
  );

  const handleColorComboChange = useCallback(
    (comboId: string) => commit((prev) => applyColorComboToState(prev, comboId)),
    [commit]
  );

  const handleBackgroundColorChange = useCallback(
    (color: string) => commit((prev) => setBackgroundColor(prev, color)),
    [commit]
  );

  const handleBadgeColorsChange = useCallback(
    (background: string, text: string) => commit((prev) => setBadgeColors(prev, background, text)),
    [commit]
  );

  const handleImageChange = useCallback(
    (image: Pick<BackgroundImageState, "url" | "fileName" | "naturalWidth" | "naturalHeight">) =>
      commit((prev) => setBackgroundImage(prev, image)),
    [commit]
  );

  const handleImageRemoved = useCallback(() => commit((prev) => clearBackgroundImage(prev)), [commit]);

  const handleImageFocusChange = useCallback(
    (focusXFrac: number, focusYFrac: number) =>
      commitDebounced((prev) => setBackgroundImageFocus(prev, focusXFrac, focusYFrac)),
    [commitDebounced]
  );

  const handleImageZoomChange = useCallback(
    (zoom: number) => commitDebounced((prev) => setBackgroundImageZoom(prev, zoom)),
    [commitDebounced]
  );

  const handleImageFitModeChange = useCallback(
    (fitMode: Parameters<typeof setBackgroundImageFitMode>[1]) => commit((prev) => setBackgroundImageFitMode(prev, fitMode)),
    [commit]
  );

  const handleDragMove = useCallback(
    (slotId: TextSlotId, offsetXFrac: number, offsetYFrac: number) =>
      commitDebounced((prev) => updateTextOffset(prev, slotId, offsetXFrac, offsetYFrac)),
    [commitDebounced]
  );

  function handleReset() {
    const confirmed = window.confirm(
      "Tem certeza que deseja começar novamente? Todas as alterações feitas nesta arte serão perdidas."
    );
    if (!confirmed) return;
    revokeImageObjectUrl(state.backgroundImage.url);
    resetHistory(createInitialEditorState());
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[20rem_minmax(0,1fr)_19rem] lg:items-start">
      {/* Área B — Visualização: em destaque no celular, ao centro no desktop. */}
      <div className="order-1 lg:order-2 lg:sticky lg:top-20">
        <EditorPreviewCanvas
          format={format}
          state={state}
          canvasRef={canvasRef}
          onDragMove={handleDragMove}
          onDragEnd={flushPending}
          onImagePan={handleImageFocusChange}
          onImageZoom={handleImageZoomChange}
        />
      </div>

      {/* Ações rápidas: desfazer/refazer/reiniciar e exportação, logo após a prévia no celular. */}
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

        <ExportPanel canvasRef={canvasRef} format={format} />

        {PublishPanelSlot ? <PublishPanelSlot canvasRef={canvasRef} format={format} state={state} /> : null}

        <Button type="button" variant="ghost" onClick={handleReset} className="w-full justify-center">
          <RotateCcw className="h-4 w-4" aria-hidden />
          Começar novamente
        </Button>
      </div>

      {/* Área A — Configurações: seções expansíveis no celular, coluna fixa no desktop. */}
      <div className="order-3 space-y-3 lg:order-1">
        <details className="group rounded-lg border border-zinc-200 lg:border-0" open>
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 lg:bg-transparent lg:px-0 lg:py-0 lg:text-base">
            Formato e template
            <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180 lg:hidden" aria-hidden />
          </summary>
          <div className="border-t border-zinc-200 p-4 lg:!block lg:border-0 lg:p-0 lg:pt-3">
            <StructureControls
              formatId={state.formatId}
              templateId={state.templateId}
              onFormatChange={handleFormatChange}
              onTemplateChange={handleTemplateChange}
            />
          </div>
        </details>

        <details className="group rounded-lg border border-zinc-200 lg:border-0" open>
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 lg:bg-transparent lg:px-0 lg:py-0 lg:text-base">
            Textos
            <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180 lg:hidden" aria-hidden />
          </summary>
          <div className="border-t border-zinc-200 p-4 lg:!block lg:border-0 lg:p-0 lg:pt-3">
            <TextControls state={state} onValueChange={handleTextValueChange} onStyleChange={handleTextStyleChange} />
          </div>
        </details>

        <details className="group rounded-lg border border-zinc-200 lg:border-0" open>
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900 lg:bg-transparent lg:px-0 lg:py-0 lg:text-base">
            Cores e imagem
            <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180 lg:hidden" aria-hidden />
          </summary>
          <div className="border-t border-zinc-200 p-4 lg:!block lg:border-0 lg:p-0 lg:pt-3">
            <BackgroundControls
              state={state}
              onColorComboChange={handleColorComboChange}
              onBackgroundColorChange={handleBackgroundColorChange}
              onBadgeColorsChange={handleBadgeColorsChange}
              onImageChange={handleImageChange}
              onImageRemoved={handleImageRemoved}
              onImageFocusChange={handleImageFocusChange}
              onImageZoomChange={handleImageZoomChange}
              onImageFitModeChange={handleImageFitModeChange}
            />
          </div>
        </details>
      </div>
    </div>
  );
}
