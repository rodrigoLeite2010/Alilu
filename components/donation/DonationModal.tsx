"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import type { DonationConfig } from "@/lib/donation/config";
import { buildPixPayload } from "@/lib/donation/pix-payload";
import { trackDonationEvent } from "@/lib/donation/analytics";
import { PixQRCode } from "./PixQRCode";

const COPIED_FEEDBACK_MS = 2000;

/**
 * Modal "❤️ Ajude o Alilu" — QR Code Pix (payload real, valor livre),
 * chave Pix e botão de copiar. Único modal de doação do site (ver
 * DonationProvider); nunca bloqueia nem pede nenhum dado do usuário —
 * a contribuição acontece inteiramente no app do banco de quem doa.
 */
export function DonationModal({
  onClose,
  config,
}: {
  onClose: () => void;
  config: DonationConfig;
}) {
  const [copied, setCopied] = useState(false);

  // Este componente só existe montado enquanto o modal está aberto (ver
  // DonationProvider): abrir de novo depois de fechar sempre cria uma
  // instância nova, com `copied` já voltando a false sozinho — sem
  // precisar de um efeito para "resetar" nada.
  useEffect(() => {
    trackDonationEvent("donation_opened");
  }, []);

  const payload = buildPixPayload({
    pixKey: config.pixKey,
    receiverName: config.receiverName,
    receiverCity: config.receiverCity,
  });

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(config.pixKey);
      setCopied(true);
      trackDonationEvent("donation_pix_copied");
      window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Dialog open title="❤️ Ajude o Alilu" onClose={onClose} size="md">
      <p className="text-sm text-zinc-700">
        O Alilu é gratuito e foi criado para facilitar tarefas do dia a dia. Se nossas ferramentas foram úteis
        para você, considere apoiar o projeto com qualquer valor via Pix.
      </p>

      <div className="flex justify-center">
        <PixQRCode payload={payload} size={220} />
      </div>

      <p className="text-center text-xs text-zinc-500">Ou escaneie o QR Code com o aplicativo do seu banco.</p>

      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
        <p className="text-xs font-medium text-zinc-500">Chave Pix</p>
        <p className="break-all text-sm text-zinc-900">{config.pixKey}</p>
      </div>

      <Button type="button" onClick={() => void handleCopy()} className="w-full justify-center">
        {copied ? "Chave Pix copiada!" : "Copiar chave Pix"}
      </Button>

      <p className="text-center text-xs text-zinc-500">
        Qualquer contribuição ajuda a manter o site funcionando e permite criar novas ferramentas.
      </p>
    </Dialog>
  );
}
