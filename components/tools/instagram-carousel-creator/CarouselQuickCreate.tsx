"use client";

import { useRef, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
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
import {
  CAROUSEL_FORMAT_IDS,
  MAX_CAROUSEL_SLIDES,
  type CarouselFormatId,
} from "@/lib/instagram/carousel/carousel-state";
import { CarouselImagePicker, type PickedCarouselImage } from "./CarouselImagePicker";

const CAROUSEL_FORMATS = POST_FORMATS.filter((format) =>
  CAROUSEL_FORMAT_IDS.includes(format.id as CarouselFormatId)
);

export interface CarouselQuickCreateImage {
  url: string;
  fileName: string | null;
  naturalWidth: number | null;
  naturalHeight: number | null;
}

export type CarouselCreationMode = "single" | "multi";

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
  /** Modo "Uma imagem + vários textos" (comportamento original, inalterado). */
  onGenerate: (text: string, image: CarouselQuickCreateImage | null) => void;
  /**
   * Modo "Várias imagens" novo: uma imagem por slide, na ordem em que
   * aparecem na lista (já refletindo qualquer reordenação feita pelo
   * usuário). Nenhum texto é definido aqui — o texto por slide, quando
   * desejado, é adicionado depois no editor completo (Estado 2), que já
   * suporta edição de texto individual por slide sem nenhuma alteração.
   */
  onGenerateFromImages: (images: CarouselQuickCreateImage[]) => void;
}

let pickedImageIdCounter = 0;
function createPickedImageId(): string {
  pickedImageIdCounter += 1;
  return `picked-${pickedImageIdCounter}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Estado 1 ("Criação") do Criador de Carrosséis (Fase 2, ETAPA 8/9, e a
 * melhoria "Várias imagens"): imagem(ns) + texto + botão "Gerar carrossel",
 * e nada mais — sem contador de slides, sem "Editando: Slide 4 de 20". A
 * tela cheia de controles só aparece DEPOIS que o sistema gera os slides
 * (Estado 2, "Revisão" — o CarouselEditorTool de sempre, IDÊNTICO para os
 * dois modos de criação).
 *
 * Dois MODOS DE CRIAÇÃO independentes do "Estado 1 vs Estado 2" acima:
 * "Uma imagem + vários textos" (comportamento original — uma imagem de
 * fundo aplicada a todos os slides, texto dividido automaticamente) e
 * "Várias imagens" (uma imagem por slide, sem nenhum texto obrigatório).
 * "Uma imagem + vários textos" é sempre o modo inicial, preservando a
 * experiência de sempre para quem não repara na nova opção.
 */
export function CarouselQuickCreate({
  formatId,
  onFormatChange,
  initialText = "",
  initialImagePreview = null,
  busy,
  error,
  onGenerate,
  onGenerateFromImages,
}: CarouselQuickCreateProps) {
  const [creationMode, setCreationMode] = useState<CarouselCreationMode>("single");

  // --- Modo "Uma imagem + vários textos" (inalterado) ---
  const [text, setText] = useState(initialText);
  const [pickedImage, setPickedImage] = useState<CarouselQuickCreateImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // A imagem efetivamente mostrada: a recém-escolhida pelo usuário nesta
  // tela, ou (se ele ainda não trocou) a prévia herdada do carrossel atual.
  const displayedImage = pickedImage ?? initialImagePreview;

  // --- Modo "Várias imagens" (novo) ---
  const [multiImages, setMultiImages] = useState<PickedCarouselImage[]>([]);
  const [multiImageError, setMultiImageError] = useState<string | null>(null);
  const [isProcessingMultiImages, setIsProcessingMultiImages] = useState(false);

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

  // Envia sempre a lista inteira de arquivos escolhidos/arrastados de uma
  // vez (FileUploadDropzone com multiple) e CONCATENA ao que já existia —
  // o ponto mais importante do pedido: um novo envio nunca substitui as
  // imagens já carregadas (Seções 3 e 9). Cada arquivo é validado
  // individualmente: um arquivo inválido não cancela o lote inteiro
  // (Seção 16), e o limite de MAX_CAROUSEL_SLIDES é respeitado sem quebrar
  // a tela (Seção 4).
  async function handleMultiFilesSelected(files: File[]) {
    if (files.length === 0) return;

    const remainingSlots = MAX_CAROUSEL_SLIDES - multiImages.length;
    if (remainingSlots <= 0) {
      setMultiImageError(
        `Você atingiu o limite de ${MAX_CAROUSEL_SLIDES} imagens. Remova alguma imagem para adicionar outras.`
      );
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    const skippedByLimit = files.length - filesToProcess.length;

    setIsProcessingMultiImages(true);
    const addedImages: PickedCarouselImage[] = [];
    const failedFiles: string[] = [];

    for (const file of filesToProcess) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        failedFiles.push(`${file.name} (${validation.error ?? "arquivo inválido"})`);
        continue;
      }

      const url = createImageObjectUrl(file);
      try {
        const image = await loadImageElement(url);
        addedImages.push({
          id: createPickedImageId(),
          url,
          fileName: file.name,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
        });
      } catch {
        revokeImageObjectUrl(url);
        failedFiles.push(`${file.name} (não foi possível abrir a imagem)`);
      }
    }

    if (addedImages.length > 0) {
      // Concatena ao array existente — nunca substitui (Seções 3 e 9).
      setMultiImages((previous) => [...previous, ...addedImages]);
    }

    const messages: string[] = [];
    if (failedFiles.length > 0) {
      messages.push(`Não foi possível usar: ${failedFiles.join(", ")}.`);
    }
    if (skippedByLimit > 0) {
      messages.push(
        `O limite é de ${MAX_CAROUSEL_SLIDES} imagens — ${skippedByLimit} arquivo${skippedByLimit === 1 ? "" : "s"} a mais não ${
          skippedByLimit === 1 ? "foi adicionado" : "foram adicionados"
        }.`
      );
    }
    setMultiImageError(messages.length > 0 ? messages.join(" ") : null);
    setIsProcessingMultiImages(false);
  }

  function handleRemoveMultiImage(id: string) {
    setMultiImages((previous) => {
      const target = previous.find((image) => image.id === id);
      revokeImageObjectUrl(target?.url ?? null);
      // Remove só essa imagem — as demais nunca são afetadas (Seção 8), e a
      // numeração dos slides seguintes se ajusta sozinha porque "Slide N" é
      // sempre calculado a partir do índice atual na lista, nunca guardado.
      return previous.filter((image) => image.id !== id);
    });
    setMultiImageError(null);
  }

  function reorderMultiImages(fromIndex: number, toIndex: number) {
    setMultiImages((previous) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        fromIndex >= previous.length ||
        toIndex < 0 ||
        toIndex >= previous.length
      ) {
        return previous;
      }
      const next = [...previous];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleMoveMultiImageUp(id: string) {
    const index = multiImages.findIndex((image) => image.id === id);
    if (index <= 0) return;
    reorderMultiImages(index, index - 1);
  }

  function handleMoveMultiImageDown(id: string) {
    const index = multiImages.findIndex((image) => image.id === id);
    if (index === -1 || index >= multiImages.length - 1) return;
    reorderMultiImages(index, index + 1);
  }

  const canGenerateMulti = multiImages.length > 0 && !busy && !isProcessingMultiImages;

  function handleGenerateMultiClick() {
    if (!canGenerateMulti) return;
    onGenerateFromImages(
      multiImages.map(({ url, fileName, naturalWidth, naturalHeight }) => ({
        url,
        fileName,
        naturalWidth,
        naturalHeight,
      }))
    );
  }

  // Troca de modo (Seção 15): se o modo que está sendo deixado já tem
  // conteúdo, confirma antes — nunca descarta silenciosamente.
  function handleModeChange(next: CarouselCreationMode) {
    if (next === creationMode || busy) return;

    const leavingHasContent =
      creationMode === "single" ? text.trim().length > 0 || pickedImage !== null : multiImages.length > 0;

    if (leavingHasContent) {
      const confirmed = window.confirm(
        "Você já adicionou conteúdo. Trocar o modo pode remover a configuração atual. Deseja continuar?"
      );
      if (!confirmed) return;

      if (creationMode === "single") {
        revokeImageObjectUrl(pickedImage?.url ?? null);
        setPickedImage(null);
        setText("");
        setImageError(null);
      } else {
        multiImages.forEach((image) => revokeImageObjectUrl(image.url));
        setMultiImages([]);
        setMultiImageError(null);
      }
    }

    setCreationMode(next);
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-1">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-zinc-900">Crie seu carrossel</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Escolha como quer começar — o Alilu cuida do resto, e você sempre pode ajustar cada slide depois.
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Como você deseja criar seu carrossel?</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleModeChange("single")}
            aria-pressed={creationMode === "single"}
            disabled={busy}
            className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
              creationMode === "single" ? "border-teal-700 bg-teal-50" : "border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <span className="block text-sm font-semibold text-zinc-900">Uma imagem + vários textos</span>
            <span className="block text-xs text-zinc-500">
              Quero criar um carrossel a partir de um texto — o Alilu divide tudo em slides.
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange("multi")}
            aria-pressed={creationMode === "multi"}
            disabled={busy}
            className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
              creationMode === "multi" ? "border-teal-700 bg-teal-50" : "border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <span className="block text-sm font-semibold text-zinc-900">Várias imagens</span>
            <span className="block text-xs text-zinc-500">
              Já tenho várias imagens e quero transformá-las em um carrossel — envie uma imagem para cada slide.
            </span>
          </button>
        </div>
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

      {creationMode === "single" ? (
        <>
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
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {displayedImage.fileName ?? "Imagem atual"}
                  </p>
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
        </>
      ) : (
        <>
          <div>
            <p className="mb-1 text-sm font-medium text-zinc-700">Imagens do carrossel</p>
            <p className="mb-2 text-xs text-zinc-500">
              Envie uma imagem para cada slide. Você pode adicionar, remover e reorganizar as imagens antes de gerar
              o carrossel.
            </p>

            <CarouselImagePicker
              images={multiImages}
              disabled={busy}
              onRemove={handleRemoveMultiImage}
              onReorder={reorderMultiImages}
              onMoveUp={handleMoveMultiImageUp}
              onMoveDown={handleMoveMultiImageDown}
            />

            {multiImages.length > 0 ? (
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-zinc-600">
                  {multiImages.length} de {MAX_CAROUSEL_SLIDES} imagens
                </p>
              </div>
            ) : null}

            <div className={multiImages.length > 0 ? "mt-3" : ""}>
              {multiImages.length >= MAX_CAROUSEL_SLIDES ? (
                <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  Você atingiu o limite de {MAX_CAROUSEL_SLIDES} imagens. Remova alguma imagem para adicionar outras.
                </p>
              ) : multiImages.length > 0 ? (
                <FileUploadDropzone
                  inputId="carousel-quick-create-multi-images"
                  title="Adicionar imagens"
                  description="Arraste uma ou mais imagens aqui ou clique para escolher"
                  limitDescription={`JPG, PNG ou WEBP, até 15 MB cada. Até ${MAX_CAROUSEL_SLIDES} imagens no total.`}
                  accept={ACCEPTED_IMAGE_INPUT_ACCEPT}
                  multiple
                  buttonLabel={isProcessingMultiImages ? "Carregando..." : "+ Adicionar imagens"}
                  disabled={isProcessingMultiImages || busy}
                  onFilesSelected={(files) => void handleMultiFilesSelected(files)}
                />
              ) : (
                <FileUploadDropzone
                  inputId="carousel-quick-create-multi-images"
                  title="Envie as imagens do seu carrossel"
                  description="Arraste uma ou mais imagens aqui ou clique para escolher — dá para selecionar várias de uma vez"
                  limitDescription={`JPG, PNG ou WEBP, até 15 MB cada. Até ${MAX_CAROUSEL_SLIDES} imagens no total.`}
                  accept={ACCEPTED_IMAGE_INPUT_ACCEPT}
                  multiple
                  buttonLabel={isProcessingMultiImages ? "Carregando..." : "+ Adicionar imagens"}
                  disabled={isProcessingMultiImages || busy}
                  onFilesSelected={(files) => void handleMultiFilesSelected(files)}
                />
              )}
            </div>

            {multiImageError ? (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {multiImageError}
              </p>
            ) : null}
          </div>

          <p className="text-xs text-zinc-500">
            Não é preciso adicionar texto agora — depois de gerar o carrossel, você pode escrever uma legenda para
            cada slide (ou deixar as imagens como estão) no editor completo.
          </p>

          <Button
            type="button"
            onClick={handleGenerateMultiClick}
            disabled={!canGenerateMulti}
            className="w-full justify-center py-3 text-base"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {busy ? "Gerando carrossel..." : "Gerar carrossel"}
          </Button>
        </>
      )}

      {error ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
