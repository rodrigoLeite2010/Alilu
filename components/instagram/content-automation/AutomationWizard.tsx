"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { getBrowserTimeZone } from "@/lib/instagram/schedule-time";
import { DAYS_OF_WEEK, DAY_OF_WEEK_LABEL, type DayOfWeek, type ImageMode, type VideoSelection } from "@/lib/content-automation/backend/automation-types";
import { WeekDayEditor, type DayFormState } from "./WeekDayEditor";
import { MediaPicker } from "./MediaPicker";

export interface AccountOption {
  id: string;
  igUsername: string | null;
}

function emptyDay(dayOfWeek: DayOfWeek): DayFormState {
  return {
    dayOfWeek,
    enabled: false,
    contentType: "POST",
    prompt: "",
    publishTime: "09:00",
    imageMediaId: null,
    videoMediaId: null,
  };
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

const STEPS = ["Conta", "Marca e modo", "Semana", "Revisão"] as const;

/**
 * Wizard de criação do Piloto Automático de Conteúdo (seção 44 do
 * briefing) — 4 etapas em uma única página (nunca persiste nada até o
 * clique final em "Criar automação": só então a automação é criada via
 * POST e cada dia configurado via PATCH, reaproveitando exatamente a
 * mesma API que a tela de edição usa).
 */
export function AutomationWizard({ userId, accounts }: { userId: string; accounts: AccountOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [instagramAccountId, setInstagramAccountId] = useState(accounts[0]?.id ?? "");
  const [name, setName] = useState("");
  const [brandContext, setBrandContext] = useState("");
  const [requireApproval, setRequireApproval] = useState(true);
  const [generationLeadMinutes, setGenerationLeadMinutes] = useState(120);
  // Nesta etapa só "imagem fixa" está disponível na UI do wizard (ver docs/content-automation.md, Pendências).
  const imageMode: ImageMode = "FIXED_IMAGE";
  const [fixedImageMediaId, setFixedImageMediaId] = useState<string | null>(null);
  const [videoSelection] = useState<VideoSelection>("FIXED");
  const [fixedVideoMediaId, setFixedVideoMediaId] = useState<string | null>(null);
  const [days, setDays] = useState<DayFormState[]>(() => DAYS_OF_WEEK.map(emptyDay));

  const nameId = useId();
  const contextId = useId();
  const leadId = useId();

  const enabledCount = useMemo(() => days.filter((day) => day.enabled).length, [days]);
  const needsImage = useMemo(() => days.some((day) => day.enabled && day.contentType === "POST"), [days]);
  const needsVideo = useMemo(() => days.some((day) => day.enabled && day.contentType === "REEL"), [days]);

  function updateDay(dayOfWeek: DayOfWeek, patch: Partial<DayFormState>) {
    setDays((list) => list.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day)));
  }

  function validateStep(current: number): string | null {
    if (current === 0 && !instagramAccountId) return "Selecione uma conta do Instagram.";
    if (current === 1 && !name.trim()) return "Dê um nome para a automação.";
    if (current === 2) {
      if (enabledCount === 0) return "Habilite pelo menos um dia da semana.";
      for (const day of days) {
        if (day.enabled && !day.prompt.trim()) {
          return `Defina o que publicar em ${DAY_OF_WEEK_LABEL[day.dayOfWeek]}.`;
        }
      }
      if (needsImage && !fixedImageMediaId && days.every((day) => !day.enabled || day.contentType !== "POST" || day.imageMediaId)) {
        // cada dia POST já tem imagem própria — ok mesmo sem imagem padrão
      } else if (needsImage && !fixedImageMediaId && days.some((day) => day.enabled && day.contentType === "POST" && !day.imageMediaId)) {
        return "Defina a imagem padrão da automação ou uma imagem específica para cada dia de Post.";
      }
      if (needsVideo && !fixedVideoMediaId && days.some((day) => day.enabled && day.contentType === "REEL" && !day.videoMediaId)) {
        return "Defina o vídeo padrão da automação ou um vídeo específico para cada dia de Reel.";
      }
    }
    return null;
  }

  function goNext() {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  }

  function goBack() {
    setError(null);
    setStep((value) => Math.max(value - 1, 0));
  }

  async function handleCreate(activateNow: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      const createResponse = await fetch("/api/content-automation/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramAccountId,
          name,
          brandContext,
          timezone: getBrowserTimeZone(),
          requireApproval,
          autoPublish: !requireApproval,
          generationLeadMinutes,
          imageMode,
          fixedImageMediaId,
          videoSelection,
          fixedVideoMediaId,
        }),
      });
      if (!createResponse.ok) {
        throw new Error(await readErrorMessage(createResponse, "Não foi possível criar a automação."));
      }
      const { id } = (await createResponse.json()) as { id: string };

      for (const day of days) {
        if (!day.enabled) continue;
        const dayResponse = await fetch(`/api/content-automation/automations/${id}/days/${day.dayOfWeek}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: true,
            contentType: day.contentType,
            prompt: day.prompt,
            publishTime: day.publishTime,
            imageMediaId: day.imageMediaId,
            videoMediaId: day.videoMediaId,
          }),
        });
        if (!dayResponse.ok) {
          throw new Error(await readErrorMessage(dayResponse, `Não foi possível salvar ${DAY_OF_WEEK_LABEL[day.dayOfWeek]}.`));
        }
      }

      if (activateNow) {
        const activateResponse = await fetch(`/api/content-automation/automations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "activate" }),
        });
        if (!activateResponse.ok) {
          // A automação já foi criada e configurada — leva para a tela de edição em vez de perder o trabalho.
          router.push(`/instagram/piloto-automatico/automacoes/${id}`);
          throw new Error(await readErrorMessage(activateResponse, "Automação criada, mas não foi possível ativar agora. Ative pela tela da automação."));
        }
      }

      router.push(`/instagram/piloto-automatico/automacoes/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a automação.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-xs font-medium text-zinc-500" aria-label="Etapas">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 ${index === step ? "bg-teal-700 text-white" : index < step ? "bg-teal-100 text-teal-800" : "bg-zinc-100"}`}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {step === 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900">Qual conta do Instagram?</h2>
          {accounts.length === 0 ? (
            <p className="text-sm text-zinc-600">
              Nenhuma conta conectada.{" "}
              <a href="/api/instagram/oauth/start" className="font-medium text-teal-800 underline">
                Conecte uma conta do Instagram
              </a>{" "}
              antes de criar uma automação.
            </p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <label
                  key={account.id}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    instagramAccountId === account.id ? "border-teal-600 bg-teal-50/50" : "border-zinc-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="instagram-account"
                    checked={instagramAccountId === account.id}
                    onChange={() => setInstagramAccountId(account.id)}
                    className="h-4 w-4 border-zinc-300 text-teal-700"
                  />
                  @{account.igUsername ?? "conta conectada"}
                </label>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900">Marca e modo de publicação</h2>
          <div>
            <label htmlFor={nameId} className="mb-1 block text-sm font-medium text-zinc-800">
              Nome da automação
            </label>
            <input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Conteúdo diário Alilu"
              className="w-full min-h-11 rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor={contextId} className="mb-1 block text-sm font-medium text-zinc-800">
              Contexto geral da marca (opcional, mas recomendado)
            </label>
            <textarea
              id={contextId}
              value={brandContext}
              onChange={(event) => setBrandContext(event.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Ex.: O Alilu é um site de ferramentas online gratuitas. O público principal são profissionais e pessoas que buscam produtividade. Use linguagem simples, prática e confiável."
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-zinc-500">Combinado com o prompt de cada dia em toda geração.</p>
          </div>
          <fieldset className="rounded-md border border-zinc-200 p-3">
            <legend className="px-1 text-sm font-medium text-zinc-800">Modo de publicação</legend>
            <label className="flex items-start gap-2 py-1 text-sm">
              <input
                type="radio"
                name="mode"
                checked={requireApproval}
                onChange={() => setRequireApproval(true)}
                className="mt-0.5 h-4 w-4 border-zinc-300 text-teal-700"
              />
              <span>
                <strong>Modo aprovação</strong> (recomendado) — o Alilu gera o conteúdo, mas só publica depois que você aprovar.
              </span>
            </label>
            <label className="flex items-start gap-2 py-1 text-sm">
              <input
                type="radio"
                name="mode"
                checked={!requireApproval}
                onChange={() => setRequireApproval(false)}
                className="mt-0.5 h-4 w-4 border-zinc-300 text-teal-700"
              />
              <span>
                <strong>Modo automático</strong> — o Alilu gera e publica sozinho, sem sua intervenção.
              </span>
            </label>
          </fieldset>
          <div>
            <label htmlFor={leadId} className="mb-1 block text-sm font-medium text-zinc-800">
              Gerar o conteúdo com quanta antecedência (minutos antes do horário)?
            </label>
            <input
              id={leadId}
              type="number"
              min={0}
              max={1440}
              value={generationLeadMinutes}
              onChange={(event) => setGenerationLeadMinutes(Math.max(0, Math.min(1440, Number(event.target.value) || 0)))}
              className="w-32 min-h-11 rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900">Configure sua semana</h2>

          <div className="rounded-md border border-zinc-200 p-4">
            <h3 className="text-sm font-semibold text-zinc-900">Imagem e vídeo padrão</h3>
            <p className="mt-1 text-xs text-zinc-600">
              Usados nos dias que não definirem uma imagem/vídeo próprios. A geração automática de arte com template ainda
              não está disponível nesta etapa — use uma imagem/vídeo real.
            </p>
            {needsImage ? (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-zinc-700">Imagem padrão (para dias de Post)</p>
                <MediaPicker userId={userId} mediaType="image" value={fixedImageMediaId} onChange={setFixedImageMediaId} />
              </div>
            ) : null}
            {needsVideo ? (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-zinc-700">Vídeo padrão (para dias de Reel)</p>
                <MediaPicker userId={userId} mediaType="video" value={fixedVideoMediaId} onChange={setFixedVideoMediaId} />
              </div>
            ) : null}
            {!needsImage && !needsVideo ? (
              <p className="mt-2 text-xs text-zinc-500">Habilite um dia abaixo para escolher o formato primeiro.</p>
            ) : null}
          </div>

          <div className="space-y-3">
            {days.map((day) => (
              <WeekDayEditor key={day.dayOfWeek} userId={userId} day={day} onChange={(patch) => updateDay(day.dayOfWeek, patch)} />
            ))}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900">Revisão</h2>
          <div className="rounded-md border border-zinc-200 p-4 text-sm">
            <p>
              <strong>Conta:</strong> @{accounts.find((a) => a.id === instagramAccountId)?.igUsername ?? "—"}
            </p>
            <p>
              <strong>Nome:</strong> {name || "—"}
            </p>
            <p>
              <strong>Modo:</strong> {requireApproval ? "Aprovação manual" : "Automático"}
            </p>
          </div>
          <div className="overflow-x-auto rounded-md border border-zinc-200">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Dia</th>
                  <th className="px-3 py-2">Formato</th>
                  <th className="px-3 py-2">Horário</th>
                  <th className="px-3 py-2">Conteúdo</th>
                </tr>
              </thead>
              <tbody>
                {days
                  .filter((day) => day.enabled)
                  .map((day) => (
                    <tr key={day.dayOfWeek} className="border-t border-zinc-100">
                      <td className="px-3 py-2 font-medium text-zinc-900">{DAY_OF_WEEK_LABEL[day.dayOfWeek]}</td>
                      <td className="px-3 py-2">{day.contentType === "POST" ? "Post" : "Reel"}</td>
                      <td className="px-3 py-2">{day.publishTime}</td>
                      <td className="max-w-xs truncate px-3 py-2 text-zinc-600">{day.prompt}</td>
                    </tr>
                  ))}
                {enabledCount === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-zinc-500">
                      Nenhum dia configurado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-500">
            A automação nasce pausada. Você pode ativá-la agora ou revisar mais tarde na tela da automação.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => handleCreate(true)} disabled={submitting}>
              {submitting ? "Criando…" : "Criar e ativar automação"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => handleCreate(false)} disabled={submitting}>
              Criar sem ativar
            </Button>
          </div>
        </section>
      ) : null}

      {step < 3 ? (
        <div className="flex justify-between border-t border-zinc-100 pt-4">
          <Button type="button" variant="ghost" onClick={goBack} disabled={step === 0}>
            Voltar
          </Button>
          <Button type="button" onClick={goNext} disabled={accounts.length === 0}>
            Continuar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
