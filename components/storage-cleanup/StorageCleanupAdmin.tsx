"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { CleanupRunView, CleanupSettings, CleanupRuleId } from "@/lib/storage-cleanup/backend/cleanup-service";

const RULE_LABEL: Record<CleanupRuleId, string> = {
  split_uploads: "Split-Screen: entradas abandonadas",
  split_outputs: "Split-Screen: vídeos gerados vencidos",
  instagram_imports_expired: "Importações do Instagram vencidas",
  instagram_imports_orphans: "Importações: uploads não registrados",
  instagram_media_orphans: "Biblioteca do Instagram: arquivos órfãos",
  ai_video_inputs: "Vídeo com IA: imagens de entrada antigas",
  ai_video_generated_orphans: "Vídeo com IA: MP4 sem registro",
};

const FIELDS: { key: keyof CleanupSettings; label: string }[] = [
  { key: "orphanGraceHours", label: "Arquivos temporários/órfãos: apagar depois de (horas)" },
  { key: "splitScreenOutputDays", label: "Vídeos gerados no Split-Screen: manter (dias)" },
  { key: "instagramImportDays", label: "Importações do Instagram: manter (dias)" },
  { key: "aiVideoInputDays", label: "Imagens de entrada do vídeo com IA: manter (dias)" },
  { key: "maxDeletesPerRun", label: "Máximo de arquivos apagados por execução" },
];

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

export function StorageCleanupAdmin({ settings, runs }: { settings: CleanupSettings; runs: CleanupRunView[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function post(key: string, body: Record<string, unknown>) {
    setBusy(key);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/storage-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(response.ok ? (key === "settings" ? "Salvo." : "Execução concluída — veja o relatório abaixo.") : (payload.error ?? "Falhou."));
      if (response.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const last = runs[0]?.report ?? null;

  return (
    <div className="mt-6 space-y-8">
      {message ? <p className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-800">{message}</p> : null}

      <section className="rounded-lg border border-zinc-200 p-4">
        <h2 className="text-base font-semibold text-zinc-900">Regras</h2>
        <div className="mt-3 flex flex-wrap gap-6 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((d) => ({ ...d, enabled: event.target.checked }))} />
            Limpeza automática ligada (cron diário)
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={draft.dryRun} onChange={(event) => setDraft((d) => ({ ...d, dryRun: event.target.checked }))} />
            Modo simulação (só relata, não apaga)
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <label key={field.key} className="block text-sm">
              <span className="mb-1 block text-zinc-700">{field.label}</span>
              <input
                type="number"
                value={String(draft[field.key])}
                onChange={(event) => setDraft((d) => ({ ...d, [field.key]: Number(event.target.value) }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Vídeos com IA já têm retenção própria (7 dias sem compra / 30 dias com compra, em Admin › IA › Precificação). Arquivos ligados a
          publicações, automações, rascunhos ou gerações em andamento nunca são apagados por estas regras.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => post("settings", { action: "settings", ...draft })} disabled={busy !== null}>
            {busy === "settings" ? "Salvando…" : "Salvar regras"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => post("simulate", { action: "run", dryRun: true })} disabled={busy !== null}>
            {busy === "simulate" ? "Simulando…" : "Simular agora"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (window.confirm("Apagar de verdade os arquivos que se encaixam nas regras? Não dá para desfazer.")) post("run", { action: "run", dryRun: false });
            }}
            disabled={busy !== null}
          >
            {busy === "run" ? "Limpando…" : "Limpar agora (apaga de verdade)"}
          </Button>
        </div>
      </section>

      {last ? (
        <section>
          <h2 className="text-base font-semibold text-zinc-900">Uso atual por pasta (última execução)</h2>
          <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            {Object.entries(last.usage).map(([folder, usage]) => (
              <li key={folder} className="flex justify-between rounded border border-zinc-200 px-3 py-2">
                <span className="text-zinc-700">{folder}/</span>
                <span className="font-medium text-zinc-900">
                  {usage.files} arquivos · {mb(usage.bytes)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-base font-semibold text-zinc-900">Últimas execuções</h2>
        {runs.length === 0 ? <p className="mt-2 text-sm text-zinc-600">Nenhuma execução ainda. Clique em “Simular agora”.</p> : null}
        <div className="mt-2 space-y-3">
          {runs.map((run) => (
            <div key={run.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={run.dryRun ? "neutral" : "brand"}>{run.dryRun ? "Simulação" : "Limpeza"}</Badge>
                <span className="text-zinc-600">
                  {formatDate(run.startedAt)} · {run.trigger === "CRON" ? "automática" : "manual"} · {run.deletedFiles}{" "}
                  {run.dryRun ? "seriam apagados" : "apagados"} · {mb(run.deletedBytes)}
                </span>
                {run.report?.stoppedEarly ? <Badge tone="warning">parou pelo tempo — continua na próxima</Badge> : null}
                {run.error ? <Badge tone="warning">erro: {run.error}</Badge> : null}
              </div>
              {run.report ? (
                <table className="mt-2 w-full text-left text-xs">
                  <thead className="text-zinc-500">
                    <tr>
                      <th className="py-1">Regra</th>
                      <th>Vistos</th>
                      <th>Elegíveis</th>
                      <th>{run.dryRun ? "Seriam apagados" : "Apagados"}</th>
                      <th>Espaço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(RULE_LABEL) as CleanupRuleId[]).map((rule) => {
                      const data = run.report!.rules[rule];
                      if (!data) return null;
                      return (
                        <tr key={rule} className="border-t border-zinc-100">
                          <td className="py-1 text-zinc-700">{RULE_LABEL[rule]}</td>
                          <td>{data.scanned}</td>
                          <td>{data.matched}</td>
                          <td>{data.deleted}</td>
                          <td>{mb(data.bytes)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
