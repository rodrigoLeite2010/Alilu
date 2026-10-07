"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { getBrowserTimeZone } from "@/lib/instagram/schedule-time";
import {
  DAYS_OF_WEEK,
  DAY_OF_WEEK_LABEL,
  type AutomationScheduleMode,
  type DayOfWeek,
  type ImageMode,
  type VideoSelection,
} from "@/lib/content-automation/backend/automation-types";
import { formatDaysSummary } from "@/lib/content-automation/shared-schedule";
import {
  SharedPromptEditor,
  emptySharedContent,
  sharedContentPayload,
  sharedScheduleError,
  type SharedScheduleState,
} from "./SharedPromptEditor";
import { WeekDayEditor, type DayFormState } from "./WeekDayEditor";
import { MediaPicker } from "./MediaPicker";
import { autoResizeTextarea } from "./textarea-utils";

export interface AccountOption {
  id: string;
  igUsername: string | null;
}

function emptyDay(dayOfWeek: DayOfWeek): DayFormState {
  return {
    dayOfWeek,
    slotIndex: 0,
    contentCategory: null,
    enabled: false,
    contentType: "POST",
    contentMode: "AI",
    prompt: "",
    manualCaption: "",
    visualText: "",
    templateId: null,
    overlayOpacity: null,
    visualTextColor: null,
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
  const [imageMode, setImageMode] = useState<ImageMode>("FIXED_IMAGE");
  const [fixedImageMediaId, setFixedImageMediaId] = useState<string | null>(null);
  const [videoSelection] = useState<VideoSelection>("FIXED");
  const [fixedVideoMediaId, setFixedVideoMediaId] = useState<string | null>(null);
  const [days, setDays] = useState<DayFormState[]>(() => DAYS_OF_WEEK.map(emptyDay));
  // "Prompt único recorrente": um conteúdo + N dias + N horários (ver SharedPromptEditor).
  const [scheduleMode, setScheduleMode] = useState<AutomationScheduleMode>("CUSTOM");
  const [sharedContent, setSharedContent] = useState<DayFormState>(emptySharedContent);
  const [sharedSchedule, setSharedSchedule] = useState<SharedScheduleState>({ days: [...DAYS_OF_WEEK], times: ["08:00"] });
  const isShared = scheduleMode === "SHARED_PROMPT";

  const nameId = useId();
  const contextId = useId();
  const leadId = useId();

  // No modo compartilhado o formato vem do conteúdo único; no personalizado, dos dias habilitados.
  const activeDays = useMemo(() => (isShared ? [sharedContent] : days.filter((day) => day.enabled)), [isShared, sharedContent, days]);
  const enabledCount = isShared ? sharedSchedule.days.length * sharedSchedule.times.length : activeDays.length;
  const needsImage = useMemo(
    () => activeDays.some((day) => day.contentType === "POST" || day.contentType === "CAROUSEL" || day.contentType === "STORY"),
    [activeDays],
  );
  const needsVideo = useMemo(() => activeDays.some((day) => day.contentType === "REEL"), [activeDays]);

  function updateDay(dayOfWeek: DayOfWeek, patch: Partial<DayFormState>) {
    setDays((list) => list.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day)));
  }

  /** Regras de conteúdo de um dia (ou do conteúdo compartilhado) — `of` é "de Segunda-feira" ou "desta automação". */
  function contentError(day: DayFormState, of: string): string | null {
    if (day.contentType === "STORY") {
      // Story: texto manual é opcional (vazio = só a imagem); no modo IA precisa do prompt.
      if (day.contentMode !== "MANUAL" && !day.prompt.trim()) return `Defina o que o Story ${of} deve dizer.`;
      return null;
    }
    if (day.contentMode === "MANUAL") {
      if (!day.manualCaption.trim()) return `Escreva a legenda manual ${of}.`;
      if (imageMode === "AUTO_TEMPLATE" && (day.contentType === "POST" || day.contentType === "CAROUSEL") && !day.visualText.trim()) {
        return day.contentType === "CAROUSEL" ? `Escreva o texto do carrossel ${of}.` : `Escreva o texto que vai sobre a imagem ${of}.`;
      }
    } else if (!day.prompt.trim()) {
      return isShared ? "Escreva o prompt do conteúdo." : `Defina o que publicar ${of.replace(/^de /, "em ")}.`;
    }
    return null;
  }

  function validateStep(current: number): string | null {
    if (current === 0 && !instagramAccountId) return "Selecione uma conta do Instagram.";
    if (current === 1 && !name.trim()) return "Dê um nome para a automação.";
    if (current === 2 && isShared) {
      const scheduleMessage = sharedScheduleError(sharedSchedule);
      if (scheduleMessage) return scheduleMessage;
      const message = contentError(sharedContent, "desta automação");
      if (message) return message;
      if (needsImage && !fixedImageMediaId && !sharedContent.imageMediaId) return "Defina a imagem padrão da automação ou uma imagem para este conteúdo.";
      if (needsVideo && !fixedVideoMediaId && !sharedContent.videoMediaId) return "Defina o vídeo padrão da automação ou um vídeo para este conteúdo.";
      return null;
    }
    if (current === 2) {
      if (enabledCount === 0) return "Habilite pelo menos um dia da semana.";
      for (const day of days) {
        if (!day.enabled) continue;
        const message = contentError(day, `de ${DAY_OF_WEEK_LABEL[day.dayOfWeek]}`);
        if (message) return message;
      }
      if (needsImage && !fixedImageMediaId && days.every((day) => !day.enabled || (day.contentType !== "POST" && day.contentType !== "CAROUSEL" && day.contentType !== "STORY") || day.imageMediaId)) {
        // cada dia POST/CAROUSEL já tem imagem própria — ok mesmo sem imagem padrão
      } else if (
        needsImage &&
        !fixedImageMediaId &&
        days.some((day) => day.enabled && (day.contentType === "POST" || day.contentType === "CAROUSEL" || day.contentType === "STORY") && !day.imageMediaId)
      ) {
        return "Defina a imagem padrão da automação ou uma imagem específica para cada dia de Post/Carrossel/Story.";
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
          scheduleMode,
        }),
      });
      if (!createResponse.ok) {
        throw new Error(await readErrorMessage(createResponse, "Não foi possível criar a automação."));
      }
      const { id } = (await createResponse.json()) as { id: string };

      if (isShared) {
        // Um único PATCH grava o prompt (uma vez) e cria as execuções (dias × horários).
        const sharedResponse = await fetch(`/api/content-automation/automations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update-shared",
            content: sharedContentPayload(sharedContent),
            schedule: sharedSchedule,
          }),
        });
        if (!sharedResponse.ok) {
          router.push(`/instagram/piloto-automatico/automacoes/${id}`);
          throw new Error(await readErrorMessage(sharedResponse, "Automação criada, mas não foi possível salvar o conteúdo e a agenda. Ajuste pela tela da automação."));
        }
      }

      for (const day of isShared ? [] : days) {
        if (!day.enabled) continue;
        const dayResponse = await fetch(`/api/content-automation/automations/${id}/days/${day.dayOfWeek}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: true,
            contentCategory: day.contentCategory,
            contentType: day.contentType,
            contentMode: day.contentMode,
            prompt: day.prompt,
            manualCaption: day.manualCaption,
            visualText: day.visualText,
            templateId: day.templateId,
            overlayOpacity: day.overlayOpacity,
            visualTextColor: day.visualTextColor,
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
          <fieldset className="rounded-md border border-zinc-200 p-3">
            <legend className="px-1 text-sm font-medium text-zinc-800">Modo de configuração</legend>
            <label className="flex items-start gap-2 py-1 text-sm">
              <input
                type="radio"
                name="schedule-mode"
                checked={scheduleMode === "SHARED_PROMPT"}
                onChange={() => setScheduleMode("SHARED_PROMPT")}
                className="mt-0.5 h-4 w-4 border-zinc-300 text-teal-700"
              />
              <span>
                <strong>Prompt único recorrente</strong> — use o mesmo prompt em vários dias e horários.
              </span>
            </label>
            <label className="flex items-start gap-2 py-1 text-sm">
              <input
                type="radio"
                name="schedule-mode"
                checked={scheduleMode === "CUSTOM"}
                onChange={() => setScheduleMode("CUSTOM")}
                className="mt-0.5 h-4 w-4 border-zinc-300 text-teal-700"
              />
              <span>
                <strong>Personalizado por dia</strong> — cada dia e horário com o seu próprio prompt.
              </span>
            </label>
          </fieldset>
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
              ref={autoResizeTextarea}
              value={brandContext}
              onChange={(event) => {
                setBrandContext(event.target.value);
                autoResizeTextarea(event.target);
              }}
              onFocus={(event) => autoResizeTextarea(event.target)}
              rows={6}
              maxLength={2000}
              placeholder="Ex.: O Alilu é um site de ferramentas online gratuitas. O público principal são profissionais e pessoas que buscam produtividade. Use linguagem simples, prática e confiável."
              className="w-full min-h-[144px] resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm leading-relaxed"
            />
            <p className="mt-1 text-xs text-zinc-500">{brandContext.length}/2000 — combinado com o prompt de cada dia em toda geração.</p>
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
          <h2 className="text-lg font-semibold text-zinc-900">{isShared ? "Configure o conteúdo e a agenda" : "Configure sua semana"}</h2>

          {needsImage ? (
            <fieldset className="rounded-md border border-zinc-200 p-4">
              <legend className="px-1 text-sm font-semibold text-zinc-900">Como definir a imagem dos posts</legend>
              <label className="flex items-start gap-2 py-1 text-sm">
                <input
                  type="radio"
                  name="image-mode"
                  checked={imageMode === "FIXED_IMAGE"}
                  onChange={() => setImageMode("FIXED_IMAGE")}
                  className="mt-0.5 h-4 w-4 border-zinc-300 text-teal-700"
                />
                <span>
                  <strong>Imagem fixa</strong> — publica a foto escolhida abaixo do jeito que ela é, sem nenhum texto desenhado em cima.
                </span>
              </label>
              <label className="flex items-start gap-2 py-1 text-sm">
                <input
                  type="radio"
                  name="image-mode"
                  checked={imageMode === "MEDIA_LIBRARY"}
                  onChange={() => setImageMode("MEDIA_LIBRARY")}
                  className="mt-0.5 h-4 w-4 border-zinc-300 text-teal-700"
                />
                <span>
                  <strong>Biblioteca de imagens</strong> — cada dia pode usar uma foto diferente da sua biblioteca, publicada como está.
                </span>
              </label>
              <label className="flex items-start gap-2 py-1 text-sm">
                <input
                  type="radio"
                  name="image-mode"
                  checked={imageMode === "AUTO_TEMPLATE"}
                  onChange={() => setImageMode("AUTO_TEMPLATE")}
                  className="mt-0.5 h-4 w-4 border-zinc-300 text-teal-700"
                />
                <span>
                  <strong>Gerar com IA sobre a imagem</strong> — escolhe um template e uma foto de fundo; a IA (ou você, no modo
                  manual) gera um texto curto que o Alilu desenha em cima da foto automaticamente.
                </span>
              </label>
            </fieldset>
          ) : null}

          <div className="rounded-md border border-zinc-200 p-4">
            <h3 className="text-sm font-semibold text-zinc-900">Imagem e vídeo padrão</h3>
            <p className="mt-1 text-xs text-zinc-600">
              Usados nos dias que não definirem uma imagem/vídeo próprios
              {imageMode === "AUTO_TEMPLATE" ? " — nesse modo, é a foto de fundo do template." : "."}
            </p>
            {needsImage ? (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-zinc-700">Imagem padrão (para dias de Post, Carrossel e Story)</p>
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

          {isShared ? (
            <SharedPromptEditor
              userId={userId}
              content={sharedContent}
              onContentChange={(patch) => setSharedContent((current) => ({ ...current, ...patch }))}
              schedule={sharedSchedule}
              onScheduleChange={setSharedSchedule}
              imageMode={imageMode}
              defaultImageMediaId={fixedImageMediaId}
              previewContext={{ instagramAccountId, automationName: name, brandContext }}
            />
          ) : (
            <>
          <div className="space-y-3">
            {days.map((day) => (
              <WeekDayEditor
                key={day.dayOfWeek}
                userId={userId}
                day={day}
                imageMode={imageMode}
                defaultImageMediaId={fixedImageMediaId}
                onChange={(patch) => updateDay(day.dayOfWeek, patch)}
                previewContext={{ instagramAccountId, automationName: name, brandContext }}
              />
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            Precisa de mais de um horário no mesmo dia (ex.: Stories às 08:00, 12:00 e 19:00)? Crie a automação e use
            “+ Adicionar horário” na tela de edição.
          </p>
            </>
          )}
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
          {isShared ? (
            <div className="rounded-md border border-zinc-200 p-4 text-sm">
              <p>
                <strong>Prompt único recorrente:</strong> {formatDaysSummary(sharedSchedule.days)} às {[...sharedSchedule.times].sort().join(", ")}.
              </p>
              <p className="mt-1 text-zinc-600">
                {(sharedContent.contentMode === "MANUAL" ? sharedContent.manualCaption : sharedContent.prompt).trim()}
              </p>
              <p className="mt-1">
                Total aproximado: <strong>{enabledCount} execuções por semana</strong>.
              </p>
            </div>
          ) : null}
          <div className={isShared ? "hidden" : "overflow-x-auto rounded-md border border-zinc-200"}>
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Dia</th>
                  <th className="px-3 py-2">Formato</th>
                  <th className="px-3 py-2">Horário</th>
                  <th className="px-3 py-2">Modo</th>
                  <th className="px-3 py-2">Conteúdo</th>
                </tr>
              </thead>
              <tbody>
                {days
                  .filter((day) => day.enabled)
                  .map((day) => (
                    <tr key={day.dayOfWeek} className="border-t border-zinc-100">
                      <td className="px-3 py-2 font-medium text-zinc-900">{DAY_OF_WEEK_LABEL[day.dayOfWeek]}</td>
                      <td className="px-3 py-2">{day.contentType === "POST" ? "Post" : day.contentType === "CAROUSEL" ? "Carrossel" : day.contentType === "STORY" ? "Story" : "Reel"}</td>
                      <td className="px-3 py-2">{day.publishTime}</td>
                      <td className="px-3 py-2">{day.contentMode === "MANUAL" ? "Manual" : "IA"}</td>
                      <td className="max-w-xs truncate px-3 py-2 text-zinc-600">
                        {day.contentMode === "MANUAL" ? day.manualCaption : day.prompt}
                      </td>
                    </tr>
                  ))}
                {enabledCount === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-zinc-500">
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
            <Button type="button" className="w-full sm:w-auto" onClick={() => handleCreate(true)} disabled={submitting}>
              {submitting ? "Criando…" : "Criar e ativar automação"}
            </Button>
            <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => handleCreate(false)} disabled={submitting}>
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
