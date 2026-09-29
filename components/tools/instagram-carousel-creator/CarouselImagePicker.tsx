"use client";

import { useState, type DragEvent } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import type { CarouselQuickCreateImage } from "./CarouselQuickCreate";

export interface PickedCarouselImage extends CarouselQuickCreateImage {
  id: string;
}

/**
 * Grade de miniaturas do modo "Várias imagens" (Estado 1, Seções 6/7/8 do
 * pedido): uma miniatura numerada por imagem, com remoção e reordenação —
 * arraste nativo (mesmo padrão de SlidesPanel.tsx, sem biblioteca de
 * drag-and-drop) e botões de mover para cima/baixo como alternativa
 * acessível para celular/teclado. Puramente apresentacional: quem chama
 * (CarouselQuickCreate) é dono da lista de imagens e de toda a lógica de
 * adicionar/validar/concatenar.
 */
export function CarouselImagePicker({
  images,
  disabled,
  onRemove,
  onReorder,
  onMoveUp,
  onMoveDown,
}: {
  images: PickedCarouselImage[];
  disabled: boolean;
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  function handleDragStart(index: number) {
    return (event: DragEvent<HTMLLIElement>) => {
      if (disabled) return;
      setDraggedIndex(index);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    };
  }

  function handleDragOver(index: number) {
    return (event: DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;
      setDropTargetIndex(index);
    };
  }

  function handleDrop(index: number) {
    return (event: DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      if (draggedIndex !== null && draggedIndex !== index) {
        onReorder(draggedIndex, index);
      }
      setDraggedIndex(null);
      setDropTargetIndex(null);
    };
  }

  function handleDragEnd() {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  }

  if (images.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((image, index) => {
        const isDropTarget = dropTargetIndex === index && draggedIndex !== null && draggedIndex !== index;

        return (
          <li
            key={image.id}
            draggable={!disabled}
            onDragStart={handleDragStart(index)}
            onDragOver={handleDragOver(index)}
            onDrop={handleDrop(index)}
            onDragEnd={handleDragEnd}
            className={`group relative rounded-lg border-2 border-zinc-200 p-1.5 transition-colors ${
              isDropTarget ? "outline outline-2 outline-offset-2 outline-teal-500" : ""
            }`}
          >
            <div className="cursor-grab overflow-hidden rounded-md active:cursor-grabbing">
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de uma URL local (blob:) gerada no navegador */}
              <img src={image.url} alt="" className="aspect-square w-full object-cover" />
            </div>

            <p className="mt-1 text-center text-xs font-semibold text-zinc-700">Slide {index + 1}</p>
            <p className="truncate text-center text-[11px] text-zinc-500">{image.fileName ?? "Imagem"}</p>

            <div className="mt-1 flex items-center justify-center gap-0.5">
              <button
                type="button"
                onClick={() => onMoveUp(image.id)}
                disabled={disabled || index === 0}
                aria-label={`Mover imagem ${index + 1} para cima`}
                className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onMoveDown(image.id)}
                disabled={disabled || index === images.length - 1}
                aria-label={`Mover imagem ${index + 1} para baixo`}
                className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onRemove(image.id)}
                disabled={disabled}
                aria-label={`Remover imagem ${index + 1}`}
                className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
