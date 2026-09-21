"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { PostFormat } from "@/lib/instagram/formats";
import type { PostEditorState } from "@/lib/instagram/editor-state";
import { drawPost, type SlotBoundingBoxMap } from "@/lib/instagram/render";
import { loadImageElement } from "@/lib/instagram/image-utils";
import { TEXT_SLOT_IDS, type TextSlotId } from "@/lib/instagram/templates";

interface DragState {
  slotId: TextSlotId;
  pointerId: number;
  startCanvasX: number;
  startCanvasY: number;
  startOffsetXFrac: number;
  startOffsetYFrac: number;
}

export function EditorPreviewCanvas({
  format,
  state,
  canvasRef,
  onDragMove,
  onDragEnd,
}: {
  format: PostFormat;
  state: PostEditorState;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onDragMove: (slotId: TextSlotId, offsetXFrac: number, offsetYFrac: number) => void;
  onDragEnd: () => void;
}) {
  const boxesRef = useRef<SlotBoundingBoxMap>({});
  const dragRef = useRef<DragState | null>(null);
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
  const [draggingSlot, setDraggingSlot] = useState<TextSlotId | null>(null);

  // Assim que a URL da imagem de fundo muda, limpamos a imagem carregada
  // imediatamente (padrão de "ajustar estado durante a renderização"
  // recomendado pelo React — evita um frame com a imagem antiga enquanto a
  // nova ainda carrega). O carregamento em si (assíncrono) continua no
  // efeito abaixo.
  if (state.backgroundImage.url !== loadedImageUrl) {
    setLoadedImageUrl(state.backgroundImage.url);
    setUploadedImage(null);
  }

  // Carrega a imagem enviada pelo usuário (URL local, nunca enviada a um
  // servidor) sempre que ela mudar, para poder desenhá-la no canvas.
  useEffect(() => {
    let cancelled = false;
    const url = state.backgroundImage.url;
    if (!url) return;

    loadImageElement(url)
      .then((image) => {
        if (!cancelled) setUploadedImage(image);
      })
      .catch(() => {
        if (!cancelled) setUploadedImage(null);
      });

    return () => {
      cancelled = true;
    };
  }, [state.backgroundImage.url]);

  // Redesenha a arte inteira sempre que o estado, o formato ou a imagem
  // carregada mudarem. O canvas já é criado na resolução real do formato —
  // é o que garante que a exportação corresponda exatamente à prévia.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    if (canvas.width !== format.width) canvas.width = format.width;
    if (canvas.height !== format.height) canvas.height = format.height;

    boxesRef.current = drawPost(ctx, format, state, uploadedImage);
  }, [state, format, uploadedImage, canvasRef]);

  function canvasPointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    return {
      x: ((event.clientX - rect.left) / rect.width) * format.width,
      y: ((event.clientY - rect.top) / rect.height) * format.height,
    };
  }

  function findSlotAtPoint(x: number, y: number): TextSlotId | null {
    const slotsTopFirst = [...TEXT_SLOT_IDS].reverse();
    for (const slotId of slotsTopFirst) {
      const box = boxesRef.current[slotId];
      if (!box) continue;
      if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
        return slotId;
      }
    }
    return null;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const point = canvasPointFromEvent(event);
    if (!point) return;
    const slotId = findSlotAtPoint(point.x, point.y);
    if (!slotId) return;

    const text = state.texts[slotId];
    dragRef.current = {
      slotId,
      pointerId: event.pointerId,
      startCanvasX: point.x,
      startCanvasY: point.y,
      startOffsetXFrac: text.offsetXFrac,
      startOffsetYFrac: text.offsetYFrac,
    };
    setDraggingSlot(slotId);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const point = canvasPointFromEvent(event);
    if (!point) return;

    const deltaXFrac = (point.x - drag.startCanvasX) / format.width;
    const deltaYFrac = (point.y - drag.startCanvasY) / format.height;
    onDragMove(drag.slotId, drag.startOffsetXFrac + deltaXFrac, drag.startOffsetYFrac + deltaYFrac);
  }

  function endDrag(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDraggingSlot(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onDragEnd();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="w-full overflow-hidden rounded-xl border border-zinc-200 bg-[repeating-conic-gradient(#f4f4f5_0%_25%,#ffffff_0%_50%)] bg-[length:20px_20px] shadow-sm"
        style={{ maxWidth: format.width >= format.height ? "min(100%, 30rem)" : "min(100%, 22rem)" }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Prévia do post do Instagram sendo criado"
          data-testid="instagram-post-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={`block w-full select-none ${draggingSlot ? "cursor-grabbing" : "cursor-grab"}`}
          style={{ aspectRatio: `${format.width} / ${format.height}`, touchAction: "none" }}
        />
      </div>
      <p className="text-center text-xs text-zinc-500">
        Dica: clique e arraste o título, o texto secundário ou o rodapé na prévia para reposicioná-los.
      </p>
    </div>
  );
}
