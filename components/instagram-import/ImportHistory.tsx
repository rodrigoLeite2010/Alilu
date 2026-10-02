"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/instagram/ConfirmDialog";
import { INSTAGRAM_IMPORT_KIND_LABEL, INSTAGRAM_IMPORT_STATUS_LABEL, type InstagramImportStatus } from "@/lib/instagram-import/url";
import type { InstagramImportDto } from "@/lib/instagram-import/backend/import-dto";
import { ImportedActions, formatDuration, formatResolution } from "./InstagramImporter";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ImportHistory({ initialImports }: { initialImports: InstagramImportDto[] }) {
  const [imports, setImports] = useState(initialImports);
  const [toDelete, setToDelete] = useState<InstagramImportDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    const response = await fetch(`/api/videos/instagram-import/${target.id}`, { method: "DELETE" });
    if (response.ok) setImports((list) => list.filter((item) => item.id !== target.id));
    else setError("Não foi possível excluir agora.");
  }

  if (imports.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-600">
        Nenhuma importação ainda.{" "}
        <a href="/videos/importar-instagram" className="font-medium text-teal-800 underline">
          Importar do Instagram
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <ul className="space-y-3">
        {imports.map((item) => (
          <li key={item.id} className="flex flex-wrap gap-4 rounded-lg border border-zinc-200 p-4">
            <div className="h-28 w-20 shrink-0 overflow-hidden rounded bg-zinc-100">
              {item.status === "COMPLETED" && item.fileUrl ? (
                item.mediaType === "VIDEO" ? (
                  <video src={`${item.fileUrl}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- arquivo importado (Blob do Alilu).
                  <img src={item.fileUrl} alt="" className="h-full w-full object-cover" />
                )
              ) : null}
            </div>
            <div className="min-w-0 flex-1 space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={item.status === "COMPLETED" ? "brand" : "warning"}>{INSTAGRAM_IMPORT_STATUS_LABEL[item.status as InstagramImportStatus] ?? item.status}</Badge>
                <span className="text-zinc-600">
                  {formatDate(item.createdAt)} · {INSTAGRAM_IMPORT_KIND_LABEL[item.kind as keyof typeof INSTAGRAM_IMPORT_KIND_LABEL] ?? item.kind}
                  {item.mediaType ? ` · ${item.mediaType === "VIDEO" ? "Vídeo" : "Foto"}` : ""}
                  {item.status === "COMPLETED" ? ` · ${formatDuration(item.durationSeconds)} · ${formatResolution(item.width, item.height)}` : ""}
                </span>
              </div>
              <p className="truncate text-zinc-500" title={item.originalUrl}>
                Origem: {item.kind === "manual" ? "upload manual" : item.normalizedUrl.replace("https://www.", "")}
              </p>
              {item.errorMessage && item.status !== "COMPLETED" ? <p className="text-red-700">{item.errorMessage}</p> : null}
              <div className="flex flex-wrap gap-2">
                {item.status === "COMPLETED" ? <ImportedActions item={item} /> : null}
                {item.status !== "COMPLETED" && item.kind !== "manual" ? (
                  <LinkButton href="/videos/importar-instagram" variant="ghost">
                    Tentar de novo
                  </LinkButton>
                ) : null}
                <Button type="button" variant="ghost" onClick={() => setToDelete(item)}>
                  Excluir
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir importação?"
        description="O arquivo importado será apagado do Alilu. Vídeos que você já gerou com ele não são afetados."
        confirmLabel="Excluir"
        onConfirm={confirmDelete}
        destructive
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
