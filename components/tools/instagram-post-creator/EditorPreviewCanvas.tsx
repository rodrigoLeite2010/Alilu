"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { PostFormat } from "@/lib/instagram/formats";
import type { PostEditorState } from "@/lib/instagram/editor-state";
import { drawPost, type RenderingContext2DLike, type SlotBoundingBoxMap } from "@/lib/instagram/render";
import { loadImageElement } from "@/lib/instagram/image-utils";
import { TEXT_SLOT_IDS, getTemplateById, type TextSlotId } from "@/lib/instagram/templates";
import { panImageFocus } from "@/lib/instagram/layout-math";
import { MAX_IMAGE_ZOOM, MIN_IMAGE_ZOOM } from "@/lib/instagram/editor-state";

interface ImageBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Arraste da própria imagem (reenquadrar) ou pinça com dois dedos (zoom). */
interface ImageGestureState {
  pointers: Map<number, { x: number; y: number }>;
  startFocusX: number;
  startFocusY: number;
  startZoom: number;
  startPoint: { x: number; y: number } | null;
  startDistance: number | null;
}

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
  onImagePan,
  onImageZoom,
}: {
  format: PostFormat;
  state: PostEditorState;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  onDragMove: (slotId: TextSlotId, offsetXFrac: number, offsetYFrac: number) => void;
  onDragEnd: () => void;
  /** Novo enquadramento da imagem do usuário (arrastar a foto na prévia). */
  onImagePan?: (focusXFrac: number, focusYFrac: number) => void;
  /** Novo zoom da imagem (pinça com dois dedos). */
  onImageZoom?: (zoom: number) => void;
}) {
  const imageGestureRef = useRef<ImageGestureState | null>(null);
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

    boxesRef.current = drawPost(ctx as unknown as RenderingContext2DLike, format, state, uploadedImage);
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

  function imageBox(): ImageBox {
    const area = getTemplateById(state.templateId).imageArea;
    if (!area) return { x: 0, y: 0, width: format.width, height: format.height };
    return {
      x: area.xFrac * format.width,
      y: area.yFrac * format.height,
      width: area.widthFrac * format.width,
      height: area.heightFrac * format.height,
    };
  }

  function canMoveImage(): boolean {
    return Boolean(uploadedImage && onImagePan && state.backgroundImage.url);
  }

  function startImageGesture(event: ReactPointerEvent<HTMLCanvasElement>, point: { x: number; y: number }) {
    const gesture: ImageGestureState = imageGestureRef.current ?? {
      pointers: new Map(),
      startFocusX: state.backgroundImage.focusXFrac,
      startFocusY: state.backgroundImage.focusYFrac,
      startZoom: state.backgroundImage.zoom ?? 1,
      startPoint: point,
      startDistance: null,
    };
    gesture.pointers.set(event.pointerId, point);
    // Recomeça a referência a cada dedo que entra/sai, para o gesto não "pular".
    gesture.startFocusX = state.backgroundImage.focusXFrac;
    gesture.startFocusY = state.backgroundImage.focusYFrac;
    gesture.startZoom = state.backgroundImage.zoom ?? 1;
    if (gesture.pointers.size === 1) {
      gesture.startPoint = point;
      gesture.startDistance = null;
    } else {
      const [a, b] = [...gesture.pointers.values()];
      gesture.startPoint = null;
      gesture.startDistance = Math.hypot(a.x - b.x, a.y - b.y) || null;
    }
    imageGestureRef.current = gesture;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveImageGesture(event: ReactPointerEvent<HTMLCanvasElement>, point: { x: number; y: number }) {
    const gesture = imageGestureRef.current;
    if (!gesture || !gesture.pointers.has(event.pointerId) || !uploadedImage) return;
    gesture.pointers.set(event.pointerId, point);
    const box = imageBox();

    if (gesture.pointers.size >= 2 && gesture.startDistance && onImageZoom) {
      const [a, b] = [...gesture.pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const zoom = Math.min(MAX_IMAGE_ZOOM, Math.max(MIN_IMAGE_ZOOM, gesture.startZoom * (distance / gesture.startDistance)));
      onImageZoom(zoom);
      return;
    }
    if (gesture.startPoint && onImagePan) {
      const next = panImageFocus({
        focusXFrac: gesture.startFocusX,
        focusYFrac: gesture.startFocusY,
        deltaXFrac: (point.x - gesture.startPoint.x) / box.width,
        deltaYFrac: (point.y - gesture.startPoint.y) / box.height,
        boxWidth: box.width,
        boxHeight: box.height,
        imageWidth: uploadedImage.naturalWidth,
        imageHeight: uploadedImage.naturalHeight,
        zoom: state.backgroundImage.zoom ?? 1,
      });
      onImagePan(next.focusXFrac, next.focusYFrac);
    }
  }

  function endImageGesture(event: ReactPointerEvent<HTMLCanvasElement>): boolean {
    const gesture = imageGestureRef.current;
    if (!gesture || !gesture.pointers.has(event.pointerId)) return false;
    gesture.pointers.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (gesture.pointers.size === 0) {
      imageGestureRef.current = null;
      onDragEnd();
    } else {
      const [remaining] = [...gesture.pointers.values()];
      gesture.startPoint = remaining;
      gesture.startDistance = null;
      gesture.startFocusX = state.backgroundImage.focusXFrac;
      gesture.startFocusY = state.backgroundImage.focusYFrac;
      gesture.startZoom = state.backgroundImage.zoom ?? 1;
    }
    return true;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const point = canvasPointFromEvent(event);
    if (!point) return;
    // Segundo dedo durante um gesto de imagem = pinça (zoom).
    if (imageGestureRef.current) {
      startImageGesture(event, point);
      return;
    }
    const slotId = findSlotAtPoint(point.x, point.y);
    if (!slotId) {
      const box = imageBox();
      const insideImage =
        point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
      if (insideImage && canMoveImage()) startImageGesture(event, point);
      return;
    }

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
    if (imageGestureRef.current) {
      const point = canvasPointFromEvent(event);
      if (point) moveImageGesture(event, point);
      return;
    }
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const point = canvasPointFromEvent(event);
    if (!point) return;

    const deltaXFrac = (point.x - drag.startCanvasX) / format.width;
    const deltaYFrac = (point.y - drag.startCanvasY) / format.height;
    onDragMove(drag.slotId, drag.startOffsetXFrac + deltaXFrac, drag.startOffsetYFrac + deltaYFrac);
  }

  function endDrag(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (endImageGesture(event)) return;
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
        Dica: arraste os textos para reposicioná-los
        {onImagePan && state.backgroundImage.url ? "; arraste a foto para enquadrar e use dois dedos para ampliar" : ""}.
      </p>
    </div>
  );
}
