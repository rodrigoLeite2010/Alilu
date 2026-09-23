"use client";

import { useRef, useState } from "react";
import { Minus, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileUploadDropzone } from "@/components/tools/pdf-shared/FileUploadDropzone";
import { ColorSwatchInput } from "./ColorSwatchInput";
import { POST_COLOR_COMBOS } from "@/lib/instagram/colors";
import {
  ACCEPTED_IMAGE_INPUT_ACCEPT,
  createImageObjectUrl,
  loadImageElement,
  revokeImageObjectUrl,
  validateImageFile,
} from "@/lib/instagram/image-utils";
import {
  MAX_IMAGE_ZOOM,
  MIN_IMAGE_ZOOM,
  type BackgroundImageState,
  type PostEditorState,
} from "@/lib/instagram/editor-state";

/**
 * Área A (fundo e cores) do editor: cor de fundo, combinações prontas, cor
 * do selo/destaque, e imagem de fundo/fotografia — enviada e processada
 * inteiramente no navegador (ETAPA 5.2 e 9: nenhuma imagem é enviada a um
 * servidor).
 */
export function BackgroundControls({
  state,
  onColorComboChange,
  onBackgroundColorChange,
  onBadgeColorsChange,
  onImageChange,
  onImageRemoved,
  onImageFocusChange,
  onImageZoomChange,
}: {
  state: PostEditorState;
  onColorComboChange: (comboId: string) => void;
  onBackgroundColorChange: (color: string) => void;
  onBadgeColorsChange: (background: string, text: string) => void;
  onImageChange: (image: Pick<BackgroundImageState, "url" | "fileName" | "naturalWidth" | "naturalHeight">) => void;
  onImageRemoved: () => void;
  onImageFocusChange: (focusXFrac: number, focusYFrac: number) => void;
  /** Opcional: quando ausente (ex.: carrossel), o controle de zoom não aparece. */
  onImageZoomChange?: (zoom: number) => void;
}) {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const zoom = state.backgroundImage.zoom ?? 1;
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  async function handleFilesSelected(files: File[]) {
    const file = files[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setImageError(validation.error ?? "Não foi possível usar essa imagem.");
      return;
    }

    setImageError(null);
    setIsProcessingImage(true);

    const previousUrl = state.backgroundImage.url;
    const url = createImageObjectUrl(file);

    try {
      const image = await loadImageElement(url);
      onImageChange({
        url,
        fileName: file.name,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      });
      revokeImageObjectUrl(previousUrl);
    } catch {
      revokeImageObjectUrl(url);
      setImageError("Não foi possível abrir essa imagem. Tente outro arquivo.");
    } finally {
      setIsProcessingImage(false);
    }
  }

  function handleRemoveImage() {
    revokeImageObjectUrl(state.backgroundImage.url);
    setImageError(null);
    onImageRemoved();
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Combinações de cores prontas</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {POST_COLOR_COMBOS.map((combo) => (
            <button
              key={combo.id}
              type="button"
              onClick={() => onColorComboChange(combo.id)}
              aria-pressed={state.colorComboId === combo.id}
              title={combo.label}
              className={`flex h-12 items-center justify-center rounded-md border-2 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                state.colorComboId === combo.id ? "border-teal-700" : "border-transparent"
              }`}
              style={{ background: combo.background, color: combo.heading }}
            >
              Aa
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
        <ColorSwatchInput
          id="instagram-post-bg-color"
          label="Cor de fundo"
          value={state.backgroundColor}
          onChange={onBackgroundColorChange}
        />
        <ColorSwatchInput
          id="instagram-post-badge-bg"
          label="Cor do selo/destaque"
          value={state.badgeBackground}
          onChange={(value) => onBadgeColorsChange(value, state.badgeTextColor)}
        />
        <ColorSwatchInput
          id="instagram-post-badge-text"
          label="Cor do texto do selo"
          value={state.badgeTextColor}
          onChange={(value) => onBadgeColorsChange(state.badgeBackground, value)}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Imagem de fundo / fotografia</p>

        {state.backgroundImage.url ? (
          <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de uma URL local (blob:) gerada no navegador, não um asset otimizável pelo next/image */}
              <img
                src={state.backgroundImage.url}
                alt=""
                className="h-16 w-16 rounded-md border border-zinc-200 object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900">{state.backgroundImage.fileName}</p>
                <p className="text-xs text-zinc-500">
                  {state.backgroundImage.naturalWidth} × {state.backgroundImage.naturalHeight}px
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={handleRemoveImage} aria-label="Remover imagem">
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => replaceInputRef.current?.click()}
                disabled={isProcessingImage}
                className="min-h-9 px-3 py-1.5 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                {isProcessingImage ? "Carregando..." : "Trocar imagem"}
              </Button>
              <input
                ref={replaceInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_INPUT_ACCEPT}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                data-testid="instagram-post-image-replace"
                onChange={(event) => {
                  void handleFilesSelected(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
            </div>

            {onImageZoomChange ? (
              <div>
                <label htmlFor="instagram-post-zoom" className="mb-1.5 block text-xs font-medium text-zinc-600">
                  Zoom da imagem ({Math.round(zoom * 100)}%)
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label="Reduzir imagem"
                    className="min-h-9 px-2"
                    disabled={zoom <= MIN_IMAGE_ZOOM}
                    onClick={() => onImageZoomChange(Math.max(MIN_IMAGE_ZOOM, zoom - 0.1))}
                  >
                    <Minus className="h-4 w-4" aria-hidden />
                  </Button>
                  <input
                    id="instagram-post-zoom"
                    type="range"
                    min={MIN_IMAGE_ZOOM}
                    max={MAX_IMAGE_ZOOM}
                    step={0.05}
                    value={zoom}
                    onChange={(event) => onImageZoomChange(Number(event.target.value))}
                    className="h-11 w-full accent-teal-700"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    aria-label="Ampliar imagem"
                    className="min-h-9 px-2"
                    disabled={zoom >= MAX_IMAGE_ZOOM}
                    onClick={() => onImageZoomChange(Math.min(MAX_IMAGE_ZOOM, zoom + 0.1))}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Dica: arraste a foto na prévia para reposicionar. A imagem nunca é distorcida — só recortada.
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="instagram-post-focus-x" className="mb-1.5 block text-xs font-medium text-zinc-600">
                  Ajustar enquadramento (horizontal)
                </label>
                <input
                  id="instagram-post-focus-x"
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={state.backgroundImage.focusXFrac}
                  onChange={(event) =>
                    onImageFocusChange(Number(event.target.value), state.backgroundImage.focusYFrac)
                  }
                  className="h-11 w-full accent-teal-700"
                />
              </div>
              <div>
                <label htmlFor="instagram-post-focus-y" className="mb-1.5 block text-xs font-medium text-zinc-600">
                  Ajustar enquadramento (vertical)
                </label>
                <input
                  id="instagram-post-focus-y"
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={state.backgroundImage.focusYFrac}
                  onChange={(event) =>
                    onImageFocusChange(state.backgroundImage.focusXFrac, Number(event.target.value))
                  }
                  className="h-11 w-full accent-teal-700"
                />
              </div>
            </div>
          </div>
        ) : (
          <FileUploadDropzone
            inputId="instagram-post-image-upload"
            title={onImageZoomChange ? "Adicionar minha imagem" : "Envie uma foto"}
            description="Arraste uma imagem aqui ou clique para escolher"
            limitDescription="JPG, PNG ou WEBP, até 15 MB. A imagem é processada só no seu navegador."
            accept={ACCEPTED_IMAGE_INPUT_ACCEPT}
            buttonLabel={isProcessingImage ? "Carregando..." : "Escolher imagem"}
            disabled={isProcessingImage}
            onFilesSelected={handleFilesSelected}
          />
        )}

        {imageError ? (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {imageError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
