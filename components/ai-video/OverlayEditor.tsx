"use client";

import { useState } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import {
  OVERLAY_POSITION_LABEL,
  buildSimpleOverlays,
  type AiVideoOverlay,
  type OverlayBackgroundStyle,
  type OverlayPosition,
  type SimpleOverlayInput,
} from "@/lib/ai-video/overlays";
import { AI_VIDEO_IMAGE_CONTENT_TYPES, type AiVideoAspectRatio } from "@/lib/ai-video/types";
import { prepareImageForUpload } from "@/lib/ai-video/prepare-image";
import { slugFileName } from "./client-utils";

const POSITIONS = Object.keys(OVERLAY_POSITION_LABEL) as OverlayPosition[];
const MAX_LOGO_BYTES = 4 * 1024 * 1024;

const ASPECT_CLASS: Record<AiVideoAspectRatio, string> = {
  "9:16": "aspect-[9/16] w-40",
  "1:1": "aspect-square w-52",
  "16:9": "aspect-video w-72",
};

function PositionSelect({ id, value, onChange }: { id: string; value: OverlayPosition; onChange: (value: OverlayPosition) => void }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as OverlayPosition)}
      className="min-h-10 rounded-md border border-zinc-300 bg-white px-2 text-sm"
    >
      {POSITIONS.map((position) => (
        <option key={position} value={position}>
          {OVERLAY_POSITION_LABEL[position]}
        </option>
      ))}
    </select>
  );
}

/**
 * "Preservar textos e logotipos" — modo simples: logo, URL, texto
 * principal e secundário em posições pré-definidas. O texto NÃO vai para
 * a IA: o Alilu aplica tudo no vídeo final, exatamente como digitado. A
 * prévia ao lado mostra onde cada item fica (proporção do vídeo).
 */
export function OverlayEditor({
  userId,
  value,
  onChange,
  imageUrl,
  aspectRatio,
}: {
  userId: string;
  value: SimpleOverlayInput;
  onChange: (value: SimpleOverlayInput) => void;
  imageUrl: string | null;
  aspectRatio: AiVideoAspectRatio;
}) {
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const set = (patch: Partial<SimpleOverlayInput>) => onChange({ ...value, ...patch });
  const overlays: AiVideoOverlay[] = buildSimpleOverlays(value);

  async function handleLogo(picked: File | null) {
    if (!picked) return;
    setLogoError(null);
    setUploading(true);
    try {
      // Celular: corrige tipo vazio/HEIC e reduz imagens grandes (mantém a transparência do PNG).
      const file = await prepareImageForUpload(picked, MAX_LOGO_BYTES);
      if (!AI_VIDEO_IMAGE_CONTENT_TYPES.includes(file.type)) {
        throw new Error("Use um logo PNG (de preferência com fundo transparente), JPG ou WebP.");
      }
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const uploaded = await uploadPresigned(`ai-video/${userId}/input/logo-${slugFileName(file.name, extension)}`, file, {
        access: "public",
        handleUploadUrl: "/api/ai-video/upload",
      });
      set({ logoUrl: uploaded.url });
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "Não foi possível enviar o logo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-4 rounded-md border border-zinc-200 bg-zinc-50/60 p-4 sm:grid-cols-[1fr_auto]">
      <div className="space-y-3 text-sm">
        <div>
          <p className="mb-1 font-medium text-zinc-800">Logo</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50">
              {uploading ? "Enviando…" : value.logoUrl ? "Trocar logo" : "Enviar logo"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploading}
                onChange={(event) => {
                  const input = event.currentTarget;
                  const file = input.files?.[0] ?? null;
                  void handleLogo(file).finally(() => {
                    input.value = "";
                  });
                }}
              />
            </label>
            {value.logoUrl ? (
              <>
                <PositionSelect id="overlay-logo-pos" value={value.logoPosition ?? "top-left"} onChange={(logoPosition) => set({ logoPosition })} />
                <button type="button" onClick={() => set({ logoUrl: null })} className="text-xs text-zinc-600 underline">
                  Remover
                </button>
              </>
            ) : null}
          </div>
          {logoError ? <p className="mt-1 text-xs text-red-600">{logoError}</p> : null}
        </div>

        {(
          [
            ["mainText", "mainTextPosition", "Texto principal", "Ex.: Promoção de inverno", "bottom-center"],
            ["secondaryText", "secondaryTextPosition", "Texto secundário", "Ex.: Só até domingo", "bottom-center"],
            ["url", "urlPosition", "Site / URL", "Ex.: www.alilu.com.br", "bottom-center"],
          ] as const
        ).map(([field, positionField, label, placeholder, defaultPosition]) => (
          <div key={field}>
            <label htmlFor={`overlay-${field}`} className="mb-1 block font-medium text-zinc-800">
              {label}
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id={`overlay-${field}`}
                value={value[field] ?? ""}
                maxLength={120}
                onChange={(event) => set({ [field]: event.target.value })}
                placeholder={placeholder}
                className="min-h-10 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3"
              />
              <PositionSelect
                id={`overlay-${field}-pos`}
                value={value[positionField] ?? defaultPosition}
                onChange={(position) => set({ [positionField]: position })}
              />
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2">
            Cor do texto
            <input
              type="color"
              value={value.textColor ?? "#ffffff"}
              onChange={(event) => set({ textColor: event.target.value })}
              className="h-9 w-12 rounded border border-zinc-300"
            />
          </label>
          <label className="inline-flex items-center gap-2">
            Fundo do texto
            <select
              value={value.background ?? "dark"}
              onChange={(event) => set({ background: event.target.value as OverlayBackgroundStyle })}
              className="min-h-10 rounded-md border border-zinc-300 bg-white px-2"
            >
              <option value="dark">Faixa escura</option>
              <option value="light">Faixa clara</option>
              <option value="none">Sem fundo</option>
            </select>
          </label>
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-zinc-600">Prévia da posição</p>
        <div className={`relative overflow-hidden rounded-md border border-zinc-300 bg-zinc-800 ${ASPECT_CLASS[aspectRatio]}`}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- prévia local da imagem enviada.
            <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
          ) : null}
          {overlays.map((overlay) => (
            <div
              key={overlay.id}
              className="absolute flex items-center overflow-hidden"
              style={{
                left: `${overlay.x * 100}%`,
                top: `${overlay.y * 100}%`,
                width: `${overlay.width * 100}%`,
                height: `${overlay.height * 100}%`,
                justifyContent: overlay.textAlign === "left" ? "flex-start" : overlay.textAlign === "right" ? "flex-end" : "center",
              }}
            >
              {overlay.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- prévia do logo enviado.
                <img src={overlay.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
              ) : (
                <span
                  className="truncate rounded px-1 text-[9px] font-semibold leading-tight"
                  style={{ color: overlay.textColor, backgroundColor: overlay.backgroundColor ?? "transparent" }}
                >
                  {overlay.text}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
