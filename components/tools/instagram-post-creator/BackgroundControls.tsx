"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
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
import type { BackgroundImageState, PostEditorState } from "@/lib/instagram/editor-state";

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
}: {
  state: PostEditorState;
  onColorComboChange: (comboId: string) => void;
  onBackgroundColorChange: (color: string) => void;
  onBadgeColorsChange: (background: string, text: string) => void;
  onImageChange: (image: Pick<BackgroundImageState, "url" | "fileName" | "naturalWidth" | "naturalHeight">) => void;
  onImageRemoved: () => void;
  onImageFocusChange: (focusXFrac: number, focusYFrac: number) => void;
}) {
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
            title="Envie uma foto"
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
