"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface Settings {
  maxImportsPerDay: number;
  maxImportedVideoSizeMb: number;
  maxImportedDurationMinutes: number;
  providerCostUsd: number;
}

const FIELDS: { key: keyof Settings; label: string; step: string }[] = [
  { key: "maxImportsPerDay", label: "Importações por usuário por dia", step: "1" },
  { key: "maxImportedVideoSizeMb", label: "Tamanho máximo do arquivo (MB)", step: "1" },
  { key: "maxImportedDurationMinutes", label: "Duração máxima do vídeo (minutos)", step: "1" },
  { key: "providerCostUsd", label: "Custo do provedor por consulta (US$, só registro)", step: "0.0001" },
];

export function ImportSettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/admin/instagram-import", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setBusy(false);
    if (response.ok) {
      setMessage("Salvo.");
      router.refresh();
    } else {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(body.error ?? "Não foi possível salvar.");
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.key} className="block text-sm">
            <span className="mb-1 block text-zinc-700">{field.label}</span>
            <input
              type="number"
              step={field.step}
              value={String(draft[field.key])}
              onChange={(event) => setDraft((current) => ({ ...current, [field.key]: Number(event.target.value) }))}
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
        ))}
      </div>
      <Button type="button" onClick={save} disabled={busy}>
        {busy ? "Salvando…" : "Salvar limites"}
      </Button>
      {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
    </div>
  );
}
