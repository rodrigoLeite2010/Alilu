"use client";

import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FileUploadDropzone } from "@/components/tools/pdf-shared/FileUploadDropzone";
import {
  ACCEPTED_IMAGE_INPUT_ACCEPT,
  createImageObjectUrl,
  loadImageElement,
  revokeImageObjectUrl,
  validateImageFile,
} from "@/lib/instagram/image-utils";
import { POST_FORMATS } from "@/lib/instagram/formats";
import { CAROUSEL_FORMAT_IDS, type CarouselFormatId } from "@/lib/instagram/carousel/carousel-state";

const CAROUSEL_FORMATS = POST_FORMATS.filter((format) =>
  CAROUSEL_FORMAT_IDS.includes(format.id as CarouselFormatId)
);

export interface CarouselQuickCreateImage {
  url: string;
  fileName: string | null;
  naturalWidth: number | null;
  naturalHeight: number | null;
}

export interface CarouselQuickCreateProps {
  formatId: CarouselFormatId;
  onFormatChange: (formatId: CarouselFormatId) => void;
  /** Pré-preenche a textarea — usado por "Editar texto original", vindo do Estado 2. */
  initialText?: string;
  /**
   * Pré-preenche a prévia da imagem com a imagem já usada no carrossel
   * atual (mesmo caso acima) — só para exibição, sem que este componente
   * "seja dono" da URL. Se o usuário não escolher um arquivo novo,
   * `onGenerate` recebe `image: null`, significando "continue usando esta
   * imagem" — quem chama decide como (normalmente clonando a imagem atual
   * do carrossel, já que cada slide precisa ser dono exclusivo da própria
   * URL — ver cloneBackgroundImage em carousel-state.ts).
   */
  initialImagePreview?: CarouselQuickCreateImage | null;
  busy: boolean;
  error: string | null;
  onGenerate: (text: string, image: CarouselQuickCreateImage | null) => void;
}

/**
 * Estado 1 ("Criação") do Criador de Carrosséis automático (Fase 2, ETAPA
 * 8/9): imagem de fundo + texto completo colado + botão "Gerar carrossel",
 * e nada mais — sem contador de slides, sem "Editando: Slide 4 de 20". A
 * tela cheia de controles (formato do slide selecionado, template, cores,
 * textos individuais...) só aparece DEPOIS que o sistema gera os slides
 * (Estado 2, "Revisão" — o CarouselEditorTool de sempre). Isso inverte o
 * fluxo antigo, onde a pessoa via a complexidade toda desde o primeiro
 * instante mesmo sem ter colado nenhum conteúdo ainda.
 */
export function CarouselQuickCreate({
  formatId,
  onFormatChange,
  initialText = "",
  initialImagePreview = null,
  busy,
  error,
  onGenerate,
}: CarouselQuickCreateProps) {
  const [text, setText] = useState(initialText);
  const [pickedImage, setPickedImage] = useState<CarouselQuickCreateImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // A imagem efetivamente mostrada: a recém-escolhida pelo usuário nesta
  // tela, ou (se ele ainda não trocou) a prévia herdada do carrossel atual.
  const displayedImage = pickedImage ?? initialImagePreview;

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
    const previousUrl = pickedImage?.url ?? null;
    const url = createImageObjectUrl(file);

    try {
      const image = await loadImageElement(url);
      setPickedImage({
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
    revokeImageObjectUrl(pickedImage?.url ?? null);
    setPickedImage(null);
    setImageError(null);
  }

  const canGenerate = text.trim().length > 0 && displayedImage !== null && !busy && !isProcessingImage;

  function handleGenerateClick() {
    if (!canGenerate) return;
    onGenerate(text, pickedImage);
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-1">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-zinc-900">Crie seu carrossel</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Escolha uma imagem de fundo e cole o texto completo — o Alilu divide tudo em slides automaticamente, do
          jeito que couber melhor em cada um.
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Formato</p>
        <div className="grid grid-cols-2 gap-2">
          {CAROUSEL_FORMATS.map((format) => (
            <button
              key={format.id}
              type="button"
              onClick={() => onFormatChange(format.id as CarouselFormatId)}
              aria-pressed={formatId === format.id}
              disabled={busy}
              className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                formatId === format.id ? "border-teal-700 bg-teal-50" : "border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <span className="block text-sm font-semibold text-zinc-900">{format.shortLabel}</span>
              <span className="block text-xs text-zinc-500">
                {format.width} × {format.height}px
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Imagem de fundo</p>
        {displayedImage ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de uma URL local (blob:) gerada no navegador, não um asset otimizável pelo next/image */}
            <img
              src={displayedImage.url}
              alt=""
              className="h-16 w-16 rounded-md border border-zinc-200 object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900">{displayedImage.fileName ?? "Imagem atual"}</p>
              {displayedImage.naturalWidth && displayedImage.naturalHeight ? (
                <p className="text-xs text-zinc-500">
                  {displayedImage.naturalWidth} × {displayedImage.naturalHeight}px
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => replaceInputRef.current?.click()}
              disabled={busy || isProcessingImage}
              className="min-h-9 px-3 py-1.5 text-xs"
            >
              {isProcessingImage ? "Carregando..." : "Trocar imagem"}
            </Button>
            {pickedImage ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleRemoveImage}
                disabled={busy}
                className="min-h-9 px-2 text-xs"
              >
                Remover
              </Button>
            ) : null}
            <input
              ref={replaceInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_INPUT_ACCEPT}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              data-testid="carousel-quick-create-image-replace"
              onChange={(event) => {
                void handleFilesSelected(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
          </div>
        ) : (
          <FileUploadDropzone
            inputId="carousel-quick-create-image"
            title="Escolha a imagem de fundo"
            description="Arraste uma imagem aqui ou clique para escolher"
            limitDescription="JPG, PNG ou WEBP, até 15 MB. É aplicada a todos os slides — dá para trocar depois."
            accept={ACCEPTED_IMAGE_INPUT_ACCEPT}
            buttonLabel={isProcessingImage ? "Carregando..." : "Escolher imagem"}
            disabled={isProcessingImage || busy}
            onFilesSelected={handleFilesSelected}
          />
        )}
        {imageError ? (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {imageError}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="carousel-quick-create-text" className="mb-2 block text-sm font-medium text-zinc-700">
          Texto completo
        </label>
        <textarea
          id="carousel-quick-create-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={busy}
          rows={10}
          placeholder="Cole aqui todo o conteúdo do carrossel — separe os parágrafos com uma linha em branco. O Alilu decide sozinho quantos slides são necessários."
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
        />
        <p className="mt-1 text-right text-xs text-zinc-500">{text.length} caracteres</p>
      </div>

      <Button
        type="button"
        onClick={handleGenerateClick}
        disabled={!canGenerate}
        className="w-full justify-center py-3 text-base"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        {busy ? "Gerando carrossel..." : "Gerar carrossel"}
      </Button>

      {error ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
