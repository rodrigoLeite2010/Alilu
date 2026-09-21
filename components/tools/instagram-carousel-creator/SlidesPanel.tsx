"use client";

import { useState, type DragEvent } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { PostFormat } from "@/lib/instagram/formats";
import type { CarouselSlide } from "@/lib/instagram/carousel/carousel-state";
import { SlideThumbnail } from "./SlideThumbnail";

/**
 * Painel de slides (ETAPA 2.1/4): miniaturas numeradas, adicionar,
 * selecionar, duplicar, excluir e reordenar. A reordenação por arraste usa
 * a API nativa de Drag and Drop do HTML5 — não há nenhuma biblioteca de
 * drag-and-drop instalada no projeto (ETAPA 4), então evitamos adicionar
 * uma dependência nova. Os botões de mover para cima/baixo cobrem o
 * celular (onde arrastar é mais difícil) e também servem como forma de
 * reordenar por teclado, já que são botões comuns, focáveis com Tab e
 * ativáveis com Enter/Espaço.
 */
export function SlidesPanel({
  slides,
  format,
  selectedSlideId,
  canAdd,
  canRemove,
  isBusy,
  maxSlides,
  onSelect,
  onAdd,
  onDuplicate,
  onRemove,
  onReorder,
  onMoveUp,
  onMoveDown,
}: {
  slides: CarouselSlide[];
  format: PostFormat;
  selectedSlideId: string;
  canAdd: boolean;
  canRemove: boolean;
  isBusy: boolean;
  maxSlides: number;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  function handleDragStart(index: number) {
    return (event: DragEvent<HTMLLIElement>) => {
      setDraggedIndex(index);
      event.dataTransfer.effectAllowed = "move";
      // Alguns navegadores exigem dados definidos para o arraste funcionar.
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-700">
          {slides.length} de {maxSlides} slides
        </p>
        <Button type="button" variant="secondary" onClick={onAdd} disabled={!canAdd || isBusy}>
          <Plus className="h-4 w-4" aria-hidden />
          Adicionar slide
        </Button>
      </div>

      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-3">
        {slides.map((slide, index) => {
          const isSelected = slide.id === selectedSlideId;
          const isDropTarget = dropTargetIndex === index && draggedIndex !== null && draggedIndex !== index;

          return (
            <li
              key={slide.id}
              draggable
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDrop={handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`group relative rounded-lg border-2 p-1.5 transition-colors ${
                isSelected ? "border-teal-700 bg-teal-50" : "border-zinc-200 hover:border-zinc-300"
              } ${isDropTarget ? "outline outline-2 outline-offset-2 outline-teal-500" : ""}`}
            >
              <button
                type="button"
                onClick={() => onSelect(slide.id)}
                aria-pressed={isSelected}
                aria-label={`Selecionar slide ${index + 1}`}
                className="block w-full cursor-grab overflow-hidden rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 active:cursor-grabbing"
              >
                <SlideThumbnail state={slide.state} format={format} />
              </button>

              <p className="mt-1 text-center text-xs font-semibold text-zinc-700">Slide {index + 1}</p>

              <div className="mt-1 flex items-center justify-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onMoveUp(slide.id)}
                  disabled={index === 0}
                  aria-label={`Mover slide ${index + 1} para cima`}
                  className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveDown(slide.id)}
                  disabled={index === slides.length - 1}
                  aria-label={`Mover slide ${index + 1} para baixo`}
                  className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicate(slide.id)}
                  disabled={!canAdd || isBusy}
                  aria-label={`Duplicar slide ${index + 1}`}
                  className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(slide.id)}
                  disabled={!canRemove}
                  aria-label={`Excluir slide ${index + 1}`}
                  className="rounded p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
