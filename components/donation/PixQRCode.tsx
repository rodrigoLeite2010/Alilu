"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { trackDonationEvent } from "@/lib/donation/analytics";

/**
 * Desenha o payload Pix (BR Code, ver lib/donation/pix-payload.ts) como um
 * QR Code real, 100% no navegador — mesmo padrão já usado pelo Gerador de
 * QR Code (components/tools/qr-code/QrCodeTool.tsx, biblioteca `qrcode`
 * já presente no projeto). Não é "um QR Code com o texto da chave": o
 * conteúdo é o payload Pix completo, reconhecido automaticamente pelos
 * aplicativos bancários como uma cobrança Pix de valor livre.
 */
export function PixQRCode({ payload, size = 220 }: { payload: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    QRCode.toCanvas(canvasRef.current, payload, { width: size, margin: 2 }, (err) => {
      if (err) {
        setError("Não foi possível gerar o QR Code do Pix agora. Você ainda pode copiar a chave Pix abaixo.");
      } else {
        setError(null);
        trackDonationEvent("donation_qrcode_viewed");
      }
    });
  }, [payload, size]);

  if (error) {
    return (
      <p role="alert" className="text-center text-sm text-red-600">
        {error}
      </p>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      role="img"
      aria-label="QR Code Pix para doação de valor livre"
      className="mx-auto block rounded-md"
    />
  );
}
