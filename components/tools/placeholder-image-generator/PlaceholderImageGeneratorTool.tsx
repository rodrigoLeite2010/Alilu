"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { NumberField } from "@/components/forms/NumberField";
import { TextField } from "@/components/forms/TextField";
import { Button } from "@/components/ui/Button";
import {
  validatePlaceholderImageInput,
  buildPlaceholderLabel,
  buildPlaceholderFileName,
  PLACEHOLDER_IMAGE_MIN_SIZE,
  PLACEHOLDER_IMAGE_MAX_SIZE,
  type PlaceholderImageFieldErrors,
  type PlaceholderImageInput,
} from "@/lib/calculators/placeholder-image-generator";

/**
 * Componente principal do Gerador de Imagem (categoria Geradores): cria
 * uma imagem de placeholder (retângulo colorido com o tamanho escrito no
 * centro) usando a Canvas API do navegador — não é geração de imagem por
 * IA. Toda a montagem acontece 100% no navegador do usuário; a imagem só
 * existe localmente até que a pessoa clique em baixar.
 */
export function PlaceholderImageGeneratorTool() {
  const [widthText, setWidthText] = useState("800");
  const [heightText, setHeightText] = useState("450");
  const [backgroundColor, setBackgroundColor] = useState("#CBD5E1");
  const [textColor, setTextColor] = useState("#1E293B");
  const [label, setLabel] = useState("");
  const [errors, setErrors] = useState<PlaceholderImageFieldErrors>({});
  const [confirmed, setConfirmed] = useState<PlaceholderImageInput | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!confirmed) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.width = confirmed.width;
    canvas.height = confirmed.height;

    ctx.fillStyle = confirmed.backgroundColor;
    ctx.fillRect(0, 0, confirmed.width, confirmed.height);

    ctx.fillStyle = confirmed.textColor;
    ctx.font = `${Math.max(14, Math.round(Math.min(confirmed.width, confirmed.height) / 8))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      buildPlaceholderLabel(confirmed.width, confirmed.height, confirmed.label),
      confirmed.width / 2,
      confirmed.height / 2
    );
  }, [confirmed]);

  function runGeneration() {
    const input: PlaceholderImageInput = {
      width: Number(widthText) || 0,
      height: Number(heightText) || 0,
      backgroundColor,
      textColor,
      label,
    };

    const nextErrors = validatePlaceholderImageInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setConfirmed(null);
      return;
    }

    setConfirmed(input);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runGeneration();
  }

  function handleDownload() {
    if (!confirmed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const url = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = url;
      link.download = buildPlaceholderFileName(confirmed.width, confirmed.height);
      link.click();
    } catch {
      // Ambiente sem suporte a canvas.toDataURL — nada a fazer.
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            id="placeholder-image-width"
            label="Largura (px)"
            hint={`Entre ${PLACEHOLDER_IMAGE_MIN_SIZE} e ${PLACEHOLDER_IMAGE_MAX_SIZE}.`}
            value={widthText}
            onChange={(event) => setWidthText(event.target.value.replace(/\D/g, ""))}
            error={errors.width}
          />
          <NumberField
            id="placeholder-image-height"
            label="Altura (px)"
            hint={`Entre ${PLACEHOLDER_IMAGE_MIN_SIZE} e ${PLACEHOLDER_IMAGE_MAX_SIZE}.`}
            value={heightText}
            onChange={(event) => setHeightText(event.target.value.replace(/\D/g, ""))}
            error={errors.height}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            id="placeholder-image-background"
            label="Cor de fundo"
            value={backgroundColor}
            onChange={(event) => setBackgroundColor(event.target.value)}
            error={errors.backgroundColor}
          />
          <TextField
            id="placeholder-image-text-color"
            label="Cor do texto"
            value={textColor}
            onChange={(event) => setTextColor(event.target.value)}
            error={errors.textColor}
          />
        </div>

        <TextField
          id="placeholder-image-label"
          label="Texto no centro"
          hint="Opcional. Se vazio, mostra a dimensão (ex.: 800 × 450)."
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />

        <Button type="submit" className="w-full sm:w-auto">
          Gerar imagem
        </Button>
      </form>

      {confirmed ? (
        <div className="mt-8 space-y-4">
          <div className="overflow-auto rounded-lg border border-zinc-200 p-4">
            <canvas ref={canvasRef} className="mx-auto max-w-full" data-testid="placeholder-image-canvas" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button type="button" onClick={handleDownload}>
              Baixar imagem (PNG)
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
