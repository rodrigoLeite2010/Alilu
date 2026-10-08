"use client";

import { useState } from "react";
import { Share2, Copy, QrCode, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { inviteUrl } from "./api";

/** Compartilhar convite: WhatsApp (share nativo quando existe), copiar link e QR code. */
export function ShareButtons({ token, groupName, compact = false }: { token: string; groupName: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const url = inviteUrl(token);
  const message = `Você foi convidado para participar do Amigo Secreto ${groupName} 🎁 Entre aqui: ${url}`;

  async function share() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `Amigo Secreto ${groupName}`, text: `Você foi convidado para participar do Amigo Secreto ${groupName} 🎁`, url });
        return;
      } catch {
        // cancelado pelo usuário: cai no WhatsApp
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link:", url);
    }
  }
  async function toggleQr() {
    if (qr) return setQr(null);
    const QRCode = (await import("qrcode")).default;
    setQr(await QRCode.toDataURL(url, { margin: 1, width: 220 }));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={share}>
          <MessageCircle className="h-4 w-4" aria-hidden /> {compact ? "WhatsApp" : "Convidar pelo WhatsApp"}
        </Button>
        <Button type="button" variant="secondary" onClick={copy}>
          <Copy className="h-4 w-4" aria-hidden /> {copied ? "Link copiado!" : "Copiar link"}
        </Button>
        <Button type="button" variant="ghost" onClick={toggleQr} aria-label="Mostrar QR code">
          <QrCode className="h-4 w-4" aria-hidden /> QR
        </Button>
        {!compact ? <Share2 className="hidden" aria-hidden /> : null}
      </div>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="QR code do convite" width={220} height={220} className="rounded-md border border-zinc-200" />
      ) : null}
    </div>
  );
}
