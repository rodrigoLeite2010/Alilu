"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { Button } from "@/components/ui/Button";
import {
  buildQrCodeContent,
  validateQrCodeInput,
  type QrCodeFieldErrors,
  type QrCodeInput,
  type QrCodeMode,
} from "@/lib/calculators/qr-code";

/**
 * Componente principal do Gerador de QR Code. Todo o processamento é 100%
 * client-side: a biblioteca `qrcode` desenha a imagem diretamente em um
 * <canvas> no navegador do usuário — nenhum texto/URL digitado é enviado
 * para servidor algum (PROMPT MESTRE, "QR Code": "Gerar QR Code 100%
 * client-side"). O conteúdo codificado é sempre o texto literal informado,
 * nunca um link intermediário do Alilu ("Não criar um redirecionador").
 */
export function QrCodeTool() {
  const [mode, setMode] = useState<QrCodeMode>("url");
  const [value, setValue] = useState("");
  const [errors, setErrors] = useState<QrCodeFieldErrors>({});
  const [content, setContent] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!content || !canvasRef.current) return;

    QRCode.toCanvas(canvasRef.current, content, { width: 280, margin: 2 }, (err) => {
      if (err) {
        setRenderError("Não foi possível gerar o QR Code para este conteúdo.");
      } else {
        setRenderError(null);
      }
    });
  }, [content]);

  function clearError(field: keyof QrCodeFieldErrors) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: QrCodeInput = { mode, value };
    const nextErrors = validateQrCodeInput(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setContent(null);
      return;
    }

    setContent(buildQrCodeContent(input));
  }

  function handleDownload() {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = "qrcode-alilu.png";
    link.click();
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <SelectField
          id="qr-code-mode"
          label="O que você quer codificar?"
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as QrCodeMode);
            setContent(null);
            clearError("value");
          }}
        >
          <option value="url">Um link (URL)</option>
          <option value="text">Um texto livre</option>
        </SelectField>

        <TextField
          id="qr-code-value"
          label={mode === "url" ? "Link" : "Texto"}
          placeholder={mode === "url" ? "https://alilu.com.br" : "Digite o texto"}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            clearError("value");
          }}
          error={errors.value}
        />

        <Button type="submit" className="w-full sm:w-auto">
          Gerar QR Code
        </Button>
      </form>

      {content ? (
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`QR Code gerado para: ${content}`}
            />
          </div>

          {renderError ? (
            <p className="text-sm text-red-600">{renderError}</p>
          ) : (
            <>
              <p className="max-w-sm break-words text-center text-xs text-zinc-500">
                Conteúdo codificado: {content}
              </p>
              <div className="flex flex-wrap justify-center gap-3 print:hidden">
                <Button type="button" onClick={handleDownload}>
                  Baixar PNG
                </Button>
                <Button type="button" variant="secondary" onClick={() => window.print()}>
                  Imprimir
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
