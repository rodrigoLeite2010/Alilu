"use client";

import { useEffect, useRef, useState } from "react";
import type { PostFormat } from "@/lib/instagram/formats";
import type { PostEditorState } from "@/lib/instagram/editor-state";
import { drawPost } from "@/lib/instagram/render";
import { loadImageElement } from "@/lib/instagram/image-utils";

/**
 * Miniatura de um slide do carrossel (ETAPA 2.1: "Exibir miniaturas
 * numeradas"). Reaproveita o mesmo `drawPost` usado pela prévia principal
 * e pela exportação — não existe nenhum desenho "simplificado" separado —,
 * mas desenha num canvas bem menor (até 160px no maior lado) para não
 * pesar no navegador com até 20 canvases simultâneos no painel de slides.
 */
const THUMBNAIL_MAX_DIMENSION = 160;

function computeThumbnailSize(format: PostFormat) {
  const scale = THUMBNAIL_MAX_DIMENSION / Math.max(format.width, format.height);
  return {
    width: Math.max(1, Math.round(format.width * scale)),
    height: Math.max(1, Math.round(format.height * scale)),
  };
}

export function SlideThumbnail({ state, format }: { state: PostEditorState; format: PostFormat }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  if (state.backgroundImage.url !== loadedUrl) {
    setLoadedUrl(state.backgroundImage.url);
    setImage(null);
  }

  useEffect(() => {
    let cancelled = false;
    const url = state.backgroundImage.url;
    if (!url) return;

    loadImageElement(url)
      .then((loaded) => {
        if (!cancelled) setImage(loaded);
      })
      .catch(() => {
        if (!cancelled) setImage(null);
      });

    return () => {
      cancelled = true;
    };
  }, [state.backgroundImage.url]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { width, height } = computeThumbnailSize(format);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    drawPost(ctx, { ...format, width: canvas.width, height: canvas.height }, state, image);
  }, [state, format, image]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ aspectRatio: `${format.width} / ${format.height}` }}
      className="block h-full w-full rounded-md bg-white object-cover"
    />
  );
}
