"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RadarPreview } from "@/lib/instagram-radar/backend/radar-service";
import { DEFAULT_RADAR_SCHEDULE, type RadarScheduleConfig } from "@/lib/instagram-radar/schedule";
import { RadarAccountSelector, useRadarAccounts } from "./RadarAccountSelector";
import { DEFAULT_RADAR_CAPTION_VALUE, RadarCaptionFields, type RadarCaptionValue } from "./RadarCaptionFields";
import { RadarLinksInput, useParsedLinks, type RadarLinksMode } from "./RadarLinksInput";
import { RadarPreviewCard } from "./RadarPreviewCard";
import { RadarScheduleFields, radarInputClass, radarLabelClass, useRadarScheduleCheck } from "./RadarScheduleFields";

export async function readRadarApiError(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string; suggestions?: string[] };
    if (!data.error) return fallback;
    return data.suggestions && data.suggestions.length > 0 ? `${data.error} Sugestões: ${data.suggestions.join(" ")}` : data.error;
  } catch {
    return fallback;
  }
}

/**
 * Criar radar: nome → conta (escolha explícita) → links (ou TXT) → frequência,
 * intervalo e janela → legendas → PRÉVIA → confirmação → "Adicionar à fila".
 * O radar nasce em rascunho: a importação começa, mas nada é publicado até a
 * pessoa ativar no painel.
 */
export function RadarCreateForm({ isAdmin = false }: { isAdmin?: boolean }) {
  const router = useRouter();
  const { accounts, needsReconnect, error: accountsError } = useRadarAccounts();
  const [name, setName] = useState("");
  const [instagramAccountId, setInstagramAccountId] = useState("");
  const [linksText, setLinksText] = useState("");
  const [mode, setMode] = useState<RadarLinksMode>("AUTHORIZED");
  const [authorized, setAuthorized] = useState(false);
  const [schedule, setSchedule] = useState<RadarScheduleConfig>(DEFAULT_RADAR_SCHEDULE);
  const [captions, setCaptions] = useState<RadarCaptionValue>(DEFAULT_RADAR_CAPTION_VALUE);
  const [preview, setPreview] = useState<RadarPreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = useParsedLinks(linksText, isAdmin);
  const scheduleCheck = useRadarScheduleCheck(schedule);

  const validate = (): string | null => {
    if (!name.trim()) return "Dê um nome ao radar.";
    if (!instagramAccountId) return "Escolha a conta do Instagram de destino.";
    if (!scheduleCheck.ok) return scheduleCheck.message;
    if (parsed.accepted.length > 0 && mode === "AUTHORIZED" && !authorized) {
      return "Confirme a autorização para importar os vídeos, ou escolha “Registrar só como referência”.";
    }
    return null;
  };

  const loadPreview = async () => {
    setError(null);
    const problem = validate();
    if (problem) return setError(problem);
    setBusy(true);
    try {
      const response = await fetch("/api/instagram-radars/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagramAccountId, schedule, links: linksText, missingCaptionPolicy: captions.missingCaptionPolicy }),
      });
      if (!response.ok) return setError(await readRadarApiError(response, "Não foi possível calcular a prévia."));
      setPreview((await response.json()) as RadarPreview);
      setConfirming(true);
    } catch {
      setError("Não foi possível calcular a prévia. Confira a conexão.");
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setError(null);
    const problem = validate();
    if (problem) return setError(problem);
    setBusy(true);
    try {
      const response = await fetch("/api/instagram-radars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, instagramAccountId, schedule, links: linksText, mode, authorized, ...captions }),
      });
      if (!response.ok) return setError(await readRadarApiError(response, "Não foi possível criar o radar."));
      const data = (await response.json()) as { radarId: string };
      router.push(`/instagram/radar/${data.radarId}?criado=1`);
    } catch {
      setError("Não foi possível criar o radar. Confira a conexão e tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const selected = accounts?.find((account) => account.id === instagramAccountId);

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        void loadPreview();
      }}
    >
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Novo Radar Instagram</h1>
        <p className="mt-1 text-sm text-zinc-600">Cole os links, escolha a conta e a frequência. O Alilu importa os vídeos autorizados e publica sozinho, mesmo com o navegador fechado.</p>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold text-zinc-900">1. Nome do radar</h2>
        <label className={radarLabelClass}>
          Nome
          <input className={radarInputClass} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Radar GTA 6" required />
        </label>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-zinc-900">2. Conta do Instagram de destino</h2>
        <p className="text-xs text-zinc-600">O radar publica SOMENTE na conta escolhida. Nunca no Facebook e nunca em outra conta.</p>
        {accountsError ? <p className="text-sm text-red-700">{accountsError}</p> : null}
        <RadarAccountSelector accounts={accounts} needsReconnect={needsReconnect} value={instagramAccountId} onChange={setInstagramAccountId} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-zinc-900">3. Links dos vídeos</h2>
        <RadarLinksInput text={linksText} onTextChange={setLinksText} mode={mode} onModeChange={setMode} authorized={authorized} onAuthorizedChange={setAuthorized} isAdmin={isAdmin} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-zinc-900">4. Frequência e janela</h2>
        <RadarScheduleFields value={schedule} onChange={setSchedule} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-zinc-900">5. Legendas</h2>
        <RadarCaptionFields value={captions} onChange={setCaptions} radarName={name || "Radar"} />
      </section>

      {error ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {confirming && preview ? (
        <div className="space-y-3">
          <RadarPreviewCard preview={preview} />
          <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-800" role="alertdialog" aria-label="Confirmar">
            <p>
              Confirmar: {parsed.accepted.length} link(s) para <strong>@{selected?.username ?? "?"}</strong>
              {mode === "REFERENCE" ? " como referência (nada será baixado)" : ""}. O radar será criado como rascunho — as publicações só começam quando você ativar.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={create} className="min-h-11 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                Confirmar e adicionar à fila
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="min-h-11 rounded-md px-4 py-2 text-sm font-semibold ring-1 ring-zinc-300">
                Voltar e ajustar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="submit" disabled={busy} className="min-h-11 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Visualizar a programação
        </button>
      )}
    </form>
  );
}
