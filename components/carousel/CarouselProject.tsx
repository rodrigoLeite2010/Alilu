"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/instagram/ConfirmDialog";
import { PlansLink } from "./PlansLink";
import { carouselApi, CarouselApiError, projectAction, STATUS_LABEL, type MeDto } from "./carousel-client";

interface SlideDto {
  position: number;
  role: string;
  headline: string;
  body: string;
  cta: string;
  imageQuery: string | null;
  photoUrl: string | null;
  renderedUrl: string | null;
}
interface HookDto { id: string; style: string; headline: string; subtitle: string | null; chosen: boolean }
interface ViewDto {
  project: { id: string; title: string; topic: string; status: string; slideCount: number; templateId: string | null; chosenHookId: string | null; caption: string; hashtags: string[]; includeEndMedia: boolean; instagramAccountId: string | null; instagramPostId: string | null; completed: boolean; error: string | null };
  slides: SlideDto[];
  hooks: HookDto[];
  sources: Array<{ id: string; kind: string; title: string; url: string | null; publisher: string | null }>;
  research: { summary: string | null; keyPoints: string[] };
  templates: Array<{ id: string; name: string; description: string }>;
}
interface PhotoDto { id: string; url: string; thumbUrl: string; width: number; height: number; author: string; authorUrl: string | null; sourceUrl: string | null; provider: string }

const STEPS = ["Tema e gancho", "Roteiro", "Visual", "Legenda", "Publicar"] as const;
const HOOK_LABEL: Record<string, string> = { ORIGINAL: "Original", PROVOCATIVE: "Provocativo", AUTHORITY: "Autoridade", STORYTELLING: "Storytelling", CUSTOM: "Escrito por você" };

function SlideCard({ slide, className = "" }: { slide: SlideDto; className?: string }) {
  if (slide.renderedUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- arte final do próprio usuário
    return <img src={slide.renderedUrl} alt={`Slide ${slide.position}: ${slide.headline}`} className={`aspect-[4/5] w-full rounded-md object-cover ${className}`} />;
  }
  return (
    <div className={`relative flex aspect-[4/5] w-full flex-col justify-center overflow-hidden rounded-md bg-brand-primary p-4 text-white ${className}`} style={slide.photoUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55)), url(${slide.photoUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
      <p className="text-sm font-bold leading-tight sm:text-base">{slide.headline}</p>
      {slide.body ? <p className="mt-2 text-xs leading-snug opacity-90">{slide.body}</p> : null}
      <span className="absolute bottom-2 right-3 text-[10px] opacity-70">prévia · {slide.position}</span>
    </div>
  );
}

export function CarouselProject({ projectId }: { projectId: string }) {
  const [view, setView] = useState<ViewDto | null>(null);
  const [me, setMe] = useState<MeDto | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [customHook, setCustomHook] = useState("");
  const [instruction, setInstruction] = useState("");
  const [photoSlide, setPhotoSlide] = useState<number | null>(null);
  const [photoQuery, setPhotoQuery] = useState("");
  const [photos, setPhotos] = useState<PhotoDto[]>([]);
  const [photosAvailable, setPhotosAvailable] = useState(true);
  const [mode, setMode] = useState<"DRAFT" | "NOW" | "SCHEDULE">("NOW");
  const [scheduledAt, setScheduledAt] = useState("");
  const [accountId, setAccountId] = useState("");
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const refresh = useCallback(async () => {
    const data = await carouselApi<ViewDto>(`/api/carousel/projects/${projectId}`);
    setView(data);
    return data;
  }, [projectId]);

  useEffect(() => {
    let active = true;
    Promise.all([carouselApi<ViewDto>(`/api/carousel/projects/${projectId}`), carouselApi<MeDto>("/api/carousel/me")])
      .then(([v, m]) => {
        if (!active) return;
        setView(v);
        setMe(m);
        setAccountId(v.project.instagramAccountId ?? (m.accounts.filter((a) => a.status === "connected").length === 1 ? (m.accounts.find((a) => a.status === "connected")?.id ?? "") : ""));
        if (v.slides.length > 0) setStep(v.project.completed ? 4 : 1);
      })
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : "Não foi possível carregar."));
    return () => {
      active = false;
    };
  }, [projectId]);

  async function run<T>(key: string, fn: () => Promise<T>, after?: () => void): Promise<T | null> {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const result = await fn();
      after?.();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir agora.");
      if (e instanceof CarouselApiError && e.code === "ACCESS_DENIED") setNotice("PLANS");
      try { await refresh(); } catch { /* mantém a tela atual */ }
      return null;
    } finally {
      setBusy(null);
    }
  }
  const act = (key: string, body: Record<string, unknown>, after?: () => void) => run(key, async () => { const r = await projectAction(projectId, body); await refresh(); return r; }, after);

  if (!view) {
    return error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p> : <p className="text-sm text-zinc-500">Carregando…</p>;
  }
  const { project, slides } = view;
  const status = STATUS_LABEL[project.status] ?? STATUS_LABEL.DRAFT;
  const locked = project.status === "PUBLISHED" || project.status === "SCHEDULED";
  const hasScript = slides.length > 0;

  async function saveSlideField(slide: SlideDto, field: "headline" | "body" | "cta", value: string) {
    if (slide[field] === value) return;
    await act(`edit-${slide.position}`, { action: "edit-slide", position: slide.position, edit: { [field]: value } });
  }

  async function searchPhotos(query: string, position: number) {
    setPhotoSlide(position);
    const result = await run("photos", () => projectAction<{ available: boolean; photos: PhotoDto[] }>(projectId, { action: "search-photos", query }));
    if (result) { setPhotos(result.photos); setPhotosAvailable(result.available); }
  }

  async function doPublish() {
    const result = await act("publish", { action: "publish", mode, scheduledAt: mode === "SCHEDULE" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, accountId: accountId || undefined });
    if (result) setNotice(mode === "DRAFT" ? "Rascunho salvo no calendário." : mode === "SCHEDULE" ? "Carrossel agendado!" : "Publicando no Instagram…");
    setConfirmPublish(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/instagram/carrossel-inteligente" className="text-sm font-medium text-brand-primary underline">← Meus carrosséis</Link>
        <span className={`rounded-full px-2.5 py-1 text-xs ${status.className}`}>{status.label}</span>
      </div>
      <h1 className="text-xl font-semibold text-zinc-900">{project.title || project.topic}</h1>

      <ol className="flex gap-1 overflow-x-auto" aria-label="Etapas">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button type="button" onClick={() => setStep(index)} aria-current={step === index ? "step" : undefined} className={`min-h-11 whitespace-nowrap rounded-md px-3 text-sm font-medium ${step === index ? "bg-brand-primary text-white" : "text-brand-primary hover:bg-brand-primary-soft"}`}>
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
          <PlansLink message={error} force={notice === "PLANS"} />
        </p>
      ) : null}
      {notice && notice !== "PLANS" ? <p className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900" role="status">{notice}</p> : null}
      {project.status === "FAILED" && project.error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{project.error}</p> : null}
      {locked ? <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">Este carrossel já foi {project.status === "PUBLISHED" ? "publicado" : "agendado"}. Duplique-o na lista para criar uma nova versão.</p> : null}

      {step === 0 ? (
        <section className="space-y-4" aria-label="Tema e gancho">
          <p className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-800"><span className="font-medium">Tema:</span> {project.topic}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy !== null || locked} onClick={() => void run("research", async () => { await projectAction(projectId, { action: "research" }); await projectAction(projectId, { action: "hooks" }); await refresh(); })}>
              {busy === "research" ? "Pesquisando…" : view.research.summary ? "Pesquisar de novo + novos ganchos" : "Pesquisar e sugerir ganchos"}
            </Button>
            <Button type="button" variant="secondary" disabled={busy !== null || locked} onClick={() => void act("hooks", { action: "hooks" })}>
              {busy === "hooks" ? "Criando…" : "Só novos ganchos"}
            </Button>
          </div>
          {view.research.summary ? (
            <div className="rounded-md border border-zinc-200 p-3 text-sm">
              <p className="font-medium text-zinc-900">O que encontramos</p>
              <p className="mt-1 text-zinc-700">{view.research.summary}</p>
              {view.research.keyPoints.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-700">{view.research.keyPoints.map((p) => <li key={p}>{p}</li>)}</ul> : null}
              {view.sources.length ? (
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Fontes</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    {view.sources.map((s) => (<li key={s.id}>{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-primary underline">{s.title}</a> : s.title}{s.publisher ? <span className="text-zinc-500"> — {s.publisher}</span> : null}</li>))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          {view.hooks.length ? (
            <fieldset>
              <legend className="text-sm font-medium text-zinc-900">Escolha o gancho da capa</legend>
              <div className="mt-2 space-y-2">
                {view.hooks.map((hook) => (
                  <label key={hook.id} className={`flex cursor-pointer gap-3 rounded-md border p-3 ${project.chosenHookId === hook.id ? "border-brand-primary bg-brand-primary-soft" : "border-zinc-200"}`}>
                    <input type="radio" name="hook" className="mt-1 h-5 w-5" checked={project.chosenHookId === hook.id} disabled={busy !== null || locked} onChange={() => void act("choose", { action: "choose-hook", hookId: hook.id })} />
                    <span><span className="block text-xs text-zinc-500">{HOOK_LABEL[hook.style] ?? hook.style}</span><span className="block font-medium text-zinc-900">{hook.headline}</span>{hook.subtitle ? <span className="block text-sm text-zinc-600">{hook.subtitle}</span> : null}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (customHook.trim()) void act("custom", { action: "custom-hook", headline: customHook }, () => setCustomHook("")); }}>
            <input value={customHook} onChange={(e) => setCustomHook(e.target.value)} maxLength={70} placeholder="Ou escreva o seu gancho" aria-label="Escreva o seu gancho" className="min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base" disabled={locked} />
            <Button type="submit" variant="secondary" disabled={busy !== null || locked || !customHook.trim()}>Usar</Button>
          </form>
          <div className="flex justify-end">
            <Button type="button" disabled={busy !== null || locked} onClick={() => { if (hasScript) setConfirmRegen(true); else void act("generate", { action: "generate" }, () => setStep(1)); }}>
              {busy === "generate" ? "Escrevendo o roteiro…" : hasScript ? "Gerar roteiro de novo" : "Gerar carrossel"}
            </Button>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="space-y-4" aria-label="Roteiro">
          {!hasScript ? <p className="text-sm text-zinc-600">Ainda não há roteiro. Volte à etapa 1 e toque em “Gerar carrossel”.</p> : null}
          <ul className="space-y-4">
            {slides.map((slide) => (
              <li key={slide.position} className="grid gap-3 rounded-lg border border-zinc-200 p-3 sm:grid-cols-[160px_1fr]">
                <SlideCard slide={slide} />
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Slide {slide.position}</p>
                  <input defaultValue={slide.headline} key={`h-${slide.position}-${slide.headline}`} maxLength={70} aria-label={`Título do slide ${slide.position}`} disabled={locked} onBlur={(e) => void saveSlideField(slide, "headline", e.target.value)} className="min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base font-medium" />
                  <textarea defaultValue={slide.body} key={`b-${slide.position}-${slide.body}`} maxLength={220} rows={3} aria-label={`Texto do slide ${slide.position}`} disabled={locked} onBlur={(e) => void saveSlideField(slide, "body", e.target.value)} className="w-full rounded-md border border-zinc-300 p-3 text-base" />
                  <div className="flex flex-wrap gap-1">
                    <Button type="button" variant="ghost" className="!min-h-9 !px-3" disabled={busy !== null || locked || slide.position === 1} onClick={() => void act("mv", { action: "move-slide", from: slide.position, to: slide.position - 1 })} aria-label={`Subir slide ${slide.position}`}>↑</Button>
                    <Button type="button" variant="ghost" className="!min-h-9 !px-3" disabled={busy !== null || locked || slide.position === slides.length} onClick={() => void act("mv", { action: "move-slide", from: slide.position, to: slide.position + 1 })} aria-label={`Descer slide ${slide.position}`}>↓</Button>
                    <Button type="button" variant="ghost" className="!min-h-9 !px-3" disabled={busy !== null || locked || slides.length >= 10} onClick={() => void act("dup", { action: "duplicate-slide", position: slide.position })}>Duplicar</Button>
                    <Button type="button" variant="ghost" className="!min-h-9 !px-3 !text-red-700" disabled={busy !== null || locked || slides.length <= 5} onClick={() => void act("del", { action: "delete-slide", position: slide.position })}>Excluir</Button>
                    <Button type="button" variant="secondary" className="!min-h-9 !px-3" disabled={busy !== null || locked} onClick={() => void act(`regen-${slide.position}`, { action: "regen-slide", position: slide.position, instruction: instruction || undefined })}>{busy === `regen-${slide.position}` ? "Refazendo…" : "Refazer com IA"}</Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {hasScript ? (
            <>
              <input value={instruction} onChange={(e) => setInstruction(e.target.value)} maxLength={300} aria-label="Instrução opcional para refazer" placeholder="Instrução opcional para “Refazer com IA” (ex.: mais direto, com um exemplo)" className="min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base" />
              <div className="flex justify-end"><Button type="button" onClick={() => setStep(2)}>Continuar para o visual</Button></div>
            </>
          ) : null}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4" aria-label="Visual">
          <div>
            <p className="text-sm font-medium text-zinc-900">Modelo</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {view.templates.map((t) => (
                <button key={t.id} type="button" disabled={busy !== null || locked} onClick={() => void act("tpl", { action: "set-template", templateId: t.id })} aria-pressed={project.templateId === t.id} className={`min-h-11 rounded-md border p-3 text-left ${project.templateId === t.id ? "border-brand-primary bg-brand-primary-soft" : "border-zinc-200"}`}>
                  <span className="block text-sm font-medium text-zinc-900">{t.name}</span><span className="block text-xs text-zinc-600">{t.description}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy !== null || locked || !hasScript} onClick={() => void run("auto", async () => { const r = await projectAction<{ result: { assigned: number; missing: number[]; providerAvailable: boolean } }>(projectId, { action: "auto-photos" }); await refresh(); const { assigned, missing, providerAvailable } = r.result; setNotice(!providerAvailable ? "O banco de fotos não está configurado (chave ausente no servidor)." : assigned === 0 ? "Não encontrei fotos para esses slides. Use “Trocar foto” e tente palavras mais simples." : `${assigned} foto(s) escolhida(s).${missing.length ? ` Sem foto nos slides ${missing.join(", ")}.` : ""}`); })}>{busy === "auto" ? "Buscando fotos…" : "Escolher fotos automaticamente"}</Button>
            <Button type="button" variant="secondary" disabled={busy !== null || !hasScript} onClick={() => void act("render", { action: "render", force: true })}>{busy === "render" ? "Gerando artes…" : "Gerar prévia das artes"}</Button>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {slides.map((slide) => (
              <li key={slide.position} className="space-y-2">
                <SlideCard slide={slide} />
                <div className="flex flex-wrap gap-1">
                  <Button type="button" variant="ghost" className="!min-h-9 !px-2 text-xs" disabled={busy !== null || locked} onClick={() => { setPhotoQuery(slide.imageQuery ?? slide.headline); void searchPhotos(slide.imageQuery ?? slide.headline, slide.position); }}>Trocar foto</Button>
                  {slide.photoUrl ? <Button type="button" variant="ghost" className="!min-h-9 !px-2 text-xs" disabled={busy !== null || locked} onClick={() => void act("rmimg", { action: "remove-image", position: slide.position })}>Sem foto</Button> : null}
                </div>
              </li>
            ))}
          </ul>
          {photoSlide !== null ? (
            <div className="rounded-lg border border-zinc-200 p-3">
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void searchPhotos(photoQuery, photoSlide); }}>
                <input value={photoQuery} onChange={(e) => setPhotoQuery(e.target.value)} aria-label="Buscar fotos" className="min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base" />
                <Button type="submit" variant="secondary" disabled={busy !== null}>{busy === "photos" ? "Buscando…" : "Buscar"}</Button>
              </form>
              {!photosAvailable ? <p className="mt-2 text-sm text-amber-900">O banco de fotos ainda não está disponível. Seu carrossel funciona normalmente com os modelos.</p> : null}
              {photosAvailable && photos.length === 0 && busy !== "photos" ? <p className="mt-2 text-sm text-zinc-600">Nenhuma foto encontrada. Tente uma palavra mais simples, como “dinheiro” ou “família”.</p> : null}
              <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.map((photo) => (
                  <li key={photo.id}>
                    <button type="button" className="block w-full" onClick={() => void act("choose-photo", { action: "choose-photo", position: photoSlide, photo }, () => setPhotoSlide(null))} aria-label={`Usar foto de ${photo.author}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- miniatura do banco de fotos */}
                      <img src={photo.thumbUrl} alt="" className="aspect-[4/5] w-full rounded-md object-cover" loading="lazy" />
                    </button>
                    <p className="mt-1 truncate text-[10px] text-zinc-500">Foto: {photo.author} · {photo.provider === "pixabay" ? "Pixabay" : "Pexels"}</p>
                  </li>
                ))}
              </ul>
              <Button type="button" variant="ghost" onClick={() => setPhotoSlide(null)}>Fechar</Button>
            </div>
          ) : null}
          <div className="flex justify-end"><Button type="button" onClick={() => setStep(3)}>Continuar para a legenda</Button></div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4" aria-label="Legenda">
          <label className="block text-sm font-medium text-zinc-900" htmlFor="legenda">Legenda</label>
          <textarea id="legenda" key={project.caption} defaultValue={project.caption} rows={9} maxLength={2200} disabled={locked} onBlur={(e) => { if (e.target.value !== project.caption) void act("cap", { action: "update", caption: e.target.value }); }} className="w-full rounded-md border border-zinc-300 p-3 text-base" />
          <label className="block text-sm font-medium text-zinc-900" htmlFor="tags">Hashtags</label>
          <input id="tags" key={project.hashtags.join(" ")} defaultValue={project.hashtags.join(" ")} disabled={locked} onBlur={(e) => { const tags = e.target.value.split(/\s+/).filter(Boolean); if (tags.join(" ") !== project.hashtags.join(" ")) void act("tags", { action: "update", hashtags: tags }); }} className="min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base" />
          <label className="flex items-center gap-3 text-sm text-zinc-800"><input type="checkbox" className="h-5 w-5" checked={project.includeEndMedia} disabled={locked || busy !== null} onChange={(e) => void act("end", { action: "update", includeEndMedia: e.target.checked })} /> Incluir a imagem final padrão do meu perfil</label>
          <div className="flex flex-wrap justify-between gap-2">
            <Button type="button" variant="secondary" disabled={busy !== null || locked || !hasScript} onClick={() => void act("regen-cap", { action: "regen-caption" })}>{busy === "regen-cap" ? "Reescrevendo…" : "Reescrever legenda com IA"}</Button>
            <Button type="button" onClick={() => setStep(4)}>Continuar</Button>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="space-y-4" aria-label="Publicar">
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">{slides.map((s) => <li key={s.position}><SlideCard slide={s} /></li>)}</ul>
          {!locked ? (
            <>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-zinc-900">O que fazer com o carrossel?</legend>
                {([["NOW", "Publicar agora"], ["SCHEDULE", "Agendar"], ["DRAFT", "Salvar como rascunho no calendário"]] as const).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-3 text-sm text-zinc-800"><input type="radio" name="mode" className="h-5 w-5" checked={mode === value} onChange={() => setMode(value)} /> {label}</label>
                ))}
              </fieldset>
              {mode === "SCHEDULE" ? (
                <label className="block text-sm text-zinc-800">Data e hora<input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="mt-1 block min-h-11 rounded-md border border-zinc-300 px-3" /></label>
              ) : null}
              {me && me.accounts.length > 0 ? (
                <label className="block text-sm text-zinc-800">Perfil do Instagram
                  <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mt-1 block min-h-11 w-full rounded-md border border-zinc-300 px-3 sm:w-auto">
                    <option value="">Escolha…</option>
                    {me.accounts.filter((a) => a.status === "connected").map((a) => <option key={a.id} value={a.id}>@{a.username ?? "perfil"}</option>)}
                  </select>
                </label>
              ) : <p className="text-sm text-amber-900">Conecte uma conta do Instagram para publicar ou agendar. <a className="font-medium underline" href="/api/instagram/oauth/start?returnTo=/instagram/carrossel-inteligente">Conectar</a></p>}
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy !== null || !hasScript || (mode === "SCHEDULE" && !scheduledAt) || (mode !== "DRAFT" && !accountId && (me?.accounts.length ?? 0) > 1)} onClick={() => (mode === "NOW" ? setConfirmPublish(true) : void doPublish())}>
                  {busy === "publish" ? "Enviando…" : mode === "NOW" ? "Publicar" : mode === "SCHEDULE" ? "Agendar" : "Salvar rascunho"}
                </Button>
                {project.status !== "DRAFT" || hasScript ? <a className="inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold text-brand-primary ring-1 ring-inset ring-brand-primary/25 hover:bg-brand-primary-soft" href={`/api/carousel/projects/${projectId}/export`}>Baixar ZIP</a> : null}
              </div>
              <p className="text-xs text-zinc-500">A cota do seu plano é usada uma única vez, quando o carrossel é concluído. Refazer textos e artes antes disso não consome mais nada.</p>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              {project.status === "SCHEDULED" ? <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void act("unsch", { action: "unschedule" })}>Cancelar agendamento</Button> : <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void act("sync", { action: "sync" })}>Atualizar status</Button>}
              <a className="inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold text-brand-primary ring-1 ring-inset ring-brand-primary/25" href={`/api/carousel/projects/${projectId}/export`}>Baixar ZIP</a>
            </div>
          )}
        </section>
      ) : null}

      <ConfirmDialog open={confirmRegen} title="Gerar o roteiro de novo?" description="Os textos atuais dos slides serão substituídos. Isso não consome a cota do plano." confirmLabel="Gerar de novo" busy={busy !== null} onClose={() => setConfirmRegen(false)} onConfirm={() => { setConfirmRegen(false); void act("generate", { action: "generate" }, () => setStep(1)); }} />
      <ConfirmDialog open={confirmPublish} title="Publicar agora no Instagram?" description="O carrossel será enviado imediatamente para o perfil escolhido." confirmLabel="Publicar" busy={busy !== null} onClose={() => setConfirmPublish(false)} onConfirm={() => void doPublish()} />
    </div>
  );
}
