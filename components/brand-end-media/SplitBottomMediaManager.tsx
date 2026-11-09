"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { SplitBottomAccountDto, SplitBottomSummaryDto } from "@/lib/videos/split-bottom/split-bottom-config";
import { deleteSplitBottomFile, uploadSplitBottomFile } from "@/lib/videos/split-bottom/split-bottom-client";

const ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

function Preview({ account }: { account: SplitBottomAccountDto }) {
  const media = account.media;
  if (!media) {
    return <div className="flex h-32 w-32 items-center justify-center rounded-md border border-dashed border-zinc-300 text-xs text-zinc-400">Sem mídia</div>;
  }
  return media.kind === "VIDEO" ? (
    <video src={media.url} className="h-32 w-32 rounded-md bg-black object-cover" controls muted playsInline preload="metadata" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={media.url} alt={`Mídia fixa de @${account.username ?? "conta"}`} className="h-32 w-32 rounded-md border border-zinc-200 object-cover" />
  );
}

/**
 * Minha conta › Mídia final › Split Screen: a mídia que fica FIXA na parte de
 * baixo do Split Screen, uma para cada conta do Instagram conectada.
 */
export function SplitBottomMediaManager({ userId, initialSummary }: { userId: string; initialSummary: SplitBottomSummaryDto }) {
  const [summary, setSummary] = useState(initialSummary);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(accountId: string, action: () => Promise<SplitBottomSummaryDto>, done: string) {
    setBusy(accountId);
    setError(null);
    setNotice(null);
    try {
      setSummary(await action());
      setNotice(done);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Split Screen — parte de baixo fixa</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Essa mídia já aparece na parte de baixo do Split Screen (60/40) assim que você abre o editor ou importa um vídeo do Instagram —
        durante o vídeo inteiro, não no final. Cadastre uma para cada conta. Vídeo curto repete em loop; imagem fica parada.
      </p>
      {error ? <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      {summary.accounts.length === 0 ? (
        <p className="mt-4 rounded-md bg-zinc-50 p-3 text-sm text-zinc-600">Conecte uma conta do Instagram para cadastrar a mídia fixa do Split Screen.</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100">
          {summary.accounts.map((account) => (
            <li key={account.instagramAccountId} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start">
              <Preview account={account} />
              <div className="flex-1 text-sm">
                <p className="font-medium text-zinc-900">
                  @{account.username ?? "conta"}
                  {account.primary ? <span className="ml-2 rounded bg-teal-50 px-1.5 py-0.5 text-xs font-medium text-teal-700">principal</span> : null}
                  {!account.connected ? <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">desconectada</span> : null}
                </p>
                {account.media ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    {account.media.kind === "VIDEO" ? "Vídeo" : "Imagem"} · {account.media.width}×{account.media.height}
                    {account.media.durationSeconds ? ` · ${account.media.durationSeconds.toFixed(1)}s` : ""} ·{" "}
                    {(account.media.fileSizeBytes / 1024 / 1024).toFixed(1)} MB
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-zinc-500">Vídeo (MP4, MOV, WEBM) ou imagem (JPG, PNG, WebP).</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <label
                    className={`inline-flex cursor-pointer items-center rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 ${busy ? "pointer-events-none opacity-60" : ""}`}
                  >
                    {busy === account.instagramAccountId ? "Enviando…" : account.media ? "Alterar" : "Enviar arquivo"}
                    <input
                      type="file"
                      className="sr-only"
                      accept={ACCEPT}
                      disabled={Boolean(busy)}
                      onClick={(event) => {
                        event.currentTarget.value = "";
                      }}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void run(
                            account.instagramAccountId,
                            () => uploadSplitBottomFile(userId, account.instagramAccountId, file),
                            `Mídia fixa salva para @${account.username ?? "conta"}.`,
                          );
                        }
                      }}
                    />
                  </label>
                  {account.media ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={Boolean(busy)}
                      onClick={() => void run(account.instagramAccountId, () => deleteSplitBottomFile(account.instagramAccountId), "Mídia removida.")}
                    >
                      Excluir
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
