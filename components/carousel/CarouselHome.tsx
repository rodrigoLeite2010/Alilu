"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, LinkButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/instagram/ConfirmDialog";
import { PlansLink } from "./PlansLink";
import { carouselApi, projectAction, STATUS_LABEL, type MeDto } from "./carousel-client";

interface TopicDto {
  id: string;
  title: string;
  summary: string;
  category: string | null;
  relevanceReason: string | null;
  engagementPotential: "LOW" | "MEDIUM" | "HIGH";
}
interface CarouselSummaryDto {
  id: string;
  title: string;
  topic: string;
  status: string;
  slideCount: number;
  coverUrl: string | null;
  completed: boolean;
  updatedAt: string;
  error: string | null;
}

const POTENTIAL: Record<TopicDto["engagementPotential"], string> = { LOW: "Potencial baixo", MEDIUM: "Potencial médio", HIGH: "Alto potencial" };

type BrandDraft = {
  brandName: string;
  handle: string;
  niche: string;
  audience: string;
  objective: string;
  tone: string;
};

const EMPTY_BRAND: BrandDraft = { brandName: "", handle: "", niche: "", audience: "", objective: "", tone: "" };

function brandDraftFromMe(me: MeDto): BrandDraft {
  return {
    brandName: me.brand?.brandName ?? "",
    handle: me.brand?.handle ?? "",
    niche: me.brand?.niche ?? "",
    audience: me.brand?.audience ?? "",
    objective: me.brand?.objective ?? "",
    tone: me.brand?.tone ?? "",
  };
}

function QuotaCard({ me }: { me: MeDto }) {
  const { access } = me.billing;
  if (access.kind === "TRIAL" && access.allowed) {
    return (
      <div className="rounded-lg border border-brand-accent/40 bg-brand-accent-soft p-4 text-sm text-zinc-800">
        <p className="font-semibold text-zinc-900">Seu primeiro carrossel é grátis</p>
        <p className="mt-1">Crie, edite e publique sem pagar nada. Depois, escolha um plano para continuar.</p>
      </div>
    );
  }
  if (access.kind === "ADMIN") {
    return (
      <div className="rounded-lg border border-brand-accent/40 bg-brand-accent-soft p-4 text-sm text-zinc-800">
        <p className="font-semibold text-zinc-900">Acesso liberado</p>
        <p className="mt-1">Seu login tem acesso ilimitado ao Carrossel Inteligente, sem cobrança.</p>
      </div>
    );
  }
  if (access.kind === "PLAN") {
    const pct = access.limit > 0 ? Math.min(100, Math.round((access.used / access.limit) * 100)) : 0;
    return (
      <div className="rounded-lg border border-zinc-200 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-zinc-900">Plano {access.planName}</p>
          <p className="text-sm tabular-nums text-zinc-700">
            {access.used} de {access.limit} carrosséis neste ciclo
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100" role="progressbar" aria-valuenow={access.used} aria-valuemin={0} aria-valuemax={access.limit} aria-label="Carrosséis usados no ciclo">
          <div className="h-full rounded-full bg-brand-primary" style={{ width: `${pct}%` }} />
        </div>
        {!access.allowed ? (
          <div className="mt-2 text-sm text-amber-900">
            <p>{access.reason}</p>
            <PlansLink message={null} force />
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      <p>{access.reason ?? "Escolha um plano para criar mais carrosséis."}</p>
      <PlansLink message={null} force />
    </div>
  );
}

export function CarouselHome() {
  const router = useRouter();
  const [me, setMe] = useState<MeDto | null>(null);
  const [topics, setTopics] = useState<TopicDto[]>([]);
  const [carousels, setCarousels] = useState<CarouselSummaryDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"topics" | "theme" | "link" | "profile">("topics");
  const [slideCount, setSlideCount] = useState(8);
  const [theme, setTheme] = useState("");
  const [url, setUrl] = useState("");
  const [target, setTarget] = useState("");
  const [analysis, setAnalysis] = useState<{ id: string; target: string; summary: string } | null>(null);
  const [toDelete, setToDelete] = useState<CarouselSummaryDto | null>(null);
  const [brandDraft, setBrandDraft] = useState<BrandDraft>(EMPTY_BRAND);
  const [brandNotice, setBrandNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [meData, topicData, listData] = await Promise.all([
        carouselApi<MeDto>("/api/carousel/me"),
        carouselApi<{ topics: TopicDto[] }>("/api/carousel/topics"),
        carouselApi<{ carousels: CarouselSummaryDto[] }>("/api/carousel/projects"),
      ]);
      setMe(meData);
      setBrandDraft(brandDraftFromMe(meData));
      setTopics(topicData.topics);
      setCarousels(listData.carousels);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial dos dados da tela
    void load();
  }, [load]);

  async function run<T>(key: string, fn: () => Promise<T>): Promise<T | null> {
    setBusy(key);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir agora.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function openProject(body: Record<string, unknown>, key: string) {
    const created = await run(key, () => carouselApi<{ projectId: string }>("/api/carousel/projects", { body: { ...body, slideCount } }));
    if (!created) return;
    if (analysis) await projectAction(created.projectId, { action: "attach-analysis", analysisId: analysis.id }).catch(() => undefined);
    router.push(`/instagram/carrossel-inteligente/${created.projectId}`);
  }

  async function suggest(mode: "WEEKLY" | "TRENDS") {
    const result = await run(`suggest-${mode}`, () => carouselApi<{ topics: TopicDto[] }>("/api/carousel/topics", { body: { action: "suggest", mode } }));
    if (result) setTopics((current) => [...result.topics, ...current.filter((t) => !result.topics.some((n) => n.id === t.id))]);
  }

  async function analyze() {
    const result = await run("analyze", () => carouselApi<{ analysis: { id: string; target: string; summary: string } }>("/api/carousel/profile-analysis", { body: { target } }));
    if (result) setAnalysis(result.analysis);
  }

  async function saveBrand() {
    const saved = await run("brand", () => carouselApi<{ brand: NonNullable<MeDto["brand"]> }>("/api/carousel/brand", { method: "PUT", body: brandDraft }));
    if (!saved) return;
    setMe((current) => (current ? { ...current, brand: saved.brand } : current));
    setBrandDraft({
      brandName: saved.brand.brandName ?? "",
      handle: saved.brand.handle ?? "",
      niche: saved.brand.niche ?? "",
      audience: saved.brand.audience ?? "",
      objective: saved.brand.objective ?? "",
      tone: saved.brand.tone ?? "",
    });
    setBrandNotice("Perfil salvo. As próximas pautas já usarão esse nicho.");
  }

  const canCreate = me?.billing.access.allowed ?? false;
  const hasNiche = brandDraft.niche.trim().length > 0;
  const tabs: Array<[typeof tab, string]> = [
    ["topics", "Pautas"],
    ["theme", "Meu tema"],
    ["link", "De um link"],
    ["profile", "Analisar perfil"],
  ];

  return (
    <div className="space-y-8">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
          <PlansLink message={error} />
        </p>
      ) : null}
      {me ? <QuotaCard me={me} /> : <p className="text-sm text-zinc-500">Carregando…</p>}

      <section aria-labelledby="perfil-conteudo" className="rounded-lg border border-zinc-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="perfil-conteudo" className="text-base font-semibold text-zinc-900">Perfil do conteúdo</h2>
            <p className="mt-1 text-sm text-zinc-600">Defina os nichos e o contexto do seu perfil para a IA sugerir pautas fora do genérico.</p>
          </div>
          {hasNiche ? <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">Nicho definido</span> : null}
        </div>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void saveBrand();
          }}
        >
          <label className="block text-sm font-medium text-zinc-800" htmlFor="brand-niche">
            Nichos do perfil
            <input
              id="brand-niche"
              value={brandDraft.niche}
              onChange={(event) => {
                setBrandNotice(null);
                setBrandDraft((current) => ({ ...current, niche: event.target.value }));
              }}
              maxLength={80}
              className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base font-normal"
              placeholder="Ex.: confeitaria artesanal, estética, mercado imobiliário"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-zinc-800" htmlFor="brand-name">
              Nome da marca ou perfil
              <input
                id="brand-name"
                value={brandDraft.brandName}
                onChange={(event) => {
                  setBrandNotice(null);
                  setBrandDraft((current) => ({ ...current, brandName: event.target.value }));
                }}
                maxLength={60}
                className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base font-normal"
                placeholder="Ex.: Studio Ana"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-800" htmlFor="brand-handle">
              @ do Instagram
              <input
                id="brand-handle"
                value={brandDraft.handle}
                onChange={(event) => {
                  setBrandNotice(null);
                  setBrandDraft((current) => ({ ...current, handle: event.target.value }));
                }}
                maxLength={40}
                className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base font-normal"
                placeholder="@seuperfil"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-zinc-800" htmlFor="brand-audience">
            Público-alvo
            <input
              id="brand-audience"
              value={brandDraft.audience}
              onChange={(event) => {
                setBrandNotice(null);
                setBrandDraft((current) => ({ ...current, audience: event.target.value }));
              }}
              maxLength={200}
              className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base font-normal"
              placeholder="Ex.: mulheres de 25 a 45 anos que querem emagrecer com saúde"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-zinc-800" htmlFor="brand-objective">
              Objetivo
              <input
                id="brand-objective"
                value={brandDraft.objective}
                onChange={(event) => {
                  setBrandNotice(null);
                  setBrandDraft((current) => ({ ...current, objective: event.target.value }));
                }}
                maxLength={200}
                className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base font-normal"
                placeholder="Ex.: atrair clientes para orçamento"
              />
            </label>
            <label className="block text-sm font-medium text-zinc-800" htmlFor="brand-tone">
              Tom de voz
              <input
                id="brand-tone"
                value={brandDraft.tone}
                onChange={(event) => {
                  setBrandNotice(null);
                  setBrandDraft((current) => ({ ...current, tone: event.target.value }));
                }}
                maxLength={120}
                className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base font-normal"
                placeholder="Ex.: simples, direto e acolhedor"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy !== null || !hasNiche}>
              {busy === "brand" ? "Salvando…" : "Salvar nicho"}
            </Button>
            {brandNotice ? <p className="text-sm text-teal-800">{brandNotice}</p> : null}
            {!hasNiche ? <p className="text-sm text-red-700">Preencha pelo menos um nicho para receber pautas sugeridas.</p> : null}
          </div>
        </form>
      </section>

      <section aria-labelledby="novo" className="rounded-lg border border-zinc-200 p-4 sm:p-5">
        <h2 id="novo" className="text-base font-semibold text-zinc-900">Novo carrossel</h2>
        <div className="mt-3 flex gap-1 overflow-x-auto" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-h-11 shrink-0 rounded-md px-3 text-sm font-medium ${tab === id ? "bg-brand-primary text-white" : "text-brand-primary hover:bg-brand-primary-soft"}`}>
              {label}
            </button>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-zinc-700">
          Slides
          <select className="min-h-11 rounded-md border border-zinc-300 px-2" value={slideCount} onChange={(e) => setSlideCount(Number(e.target.value))}>
            {[5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>

        {tab === "topics" ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void suggest("WEEKLY")}>
                {busy === "suggest-WEEKLY" ? "Buscando…" : "Sugerir pautas da semana"}
              </Button>
              <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void suggest("TRENDS")}>
                {busy === "suggest-TRENDS" ? "Buscando…" : "Ver o que está em alta"}
              </Button>
            </div>
            {topics.length === 0 ? <p className="text-sm text-zinc-500">Nenhuma pauta ainda. Toque em um botão acima para a IA pesquisar temas para o seu nicho.</p> : null}
            <ul className="space-y-3">
              {topics.map((topic) => (
                <li key={topic.id} className="rounded-md border border-zinc-200 p-3">
                  <p className="font-medium text-zinc-900">{topic.title}</p>
                  <p className="mt-1 text-sm text-zinc-600">{topic.summary}</p>
                  {topic.relevanceReason ? <p className="mt-1 text-xs text-zinc-500">{topic.relevanceReason}</p> : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700">{POTENTIAL[topic.engagementPotential]}</span>
                    <Button type="button" disabled={busy !== null || !canCreate} onClick={() => void openProject({ from: "topic", topicId: topic.id }, `t-${topic.id}`)}>
                      {busy === `t-${topic.id}` ? "Criando…" : "Criar carrossel"}
                    </Button>
                    <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void run(`d-${topic.id}`, async () => { await carouselApi("/api/carousel/topics", { body: { action: "dismiss", topicId: topic.id } }); setTopics((c) => c.filter((t) => t.id !== topic.id)); })}>
                      Dispensar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {tab === "theme" ? (
          <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void openProject({ from: "custom", topic: theme }, "theme"); }}>
            <label className="block text-sm font-medium text-zinc-800" htmlFor="tema">Sobre o que é o carrossel?</label>
            <textarea id="tema" value={theme} onChange={(e) => setTheme(e.target.value)} maxLength={200} rows={3} className="w-full rounded-md border border-zinc-300 p-3 text-base" placeholder="Ex.: 5 erros que travam o crescimento de uma loja virtual" />
            <Button type="submit" disabled={busy !== null || !canCreate || theme.trim().length < 3}>{busy === "theme" ? "Criando…" : "Começar"}</Button>
          </form>
        ) : null}

        {tab === "link" ? (
          <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void openProject({ from: "url", url }, "url"); }}>
            <label className="block text-sm font-medium text-zinc-800" htmlFor="link">Link de uma matéria ou artigo</label>
            <input id="link" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} className="min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base" placeholder="https://…" />
            <p className="text-xs text-zinc-500">Usamos o conteúdo só como referência: o carrossel é escrito com outras palavras e cita a fonte.</p>
            <Button type="submit" disabled={busy !== null || !canCreate || !url.trim()}>{busy === "url" ? "Lendo o link…" : "Criar a partir do link"}</Button>
          </form>
        ) : null}

        {tab === "profile" ? (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-zinc-800" htmlFor="perfil">Perfil público de referência</label>
            <div className="flex gap-2">
              <input id="perfil" value={target} onChange={(e) => setTarget(e.target.value)} className="min-h-11 w-full rounded-md border border-zinc-300 px-3 text-base" placeholder="@perfil" />
              <Button type="button" variant="secondary" disabled={busy !== null || !target.trim()} onClick={() => void analyze()}>{busy === "analyze" ? "Analisando…" : "Analisar"}</Button>
            </div>
            <p className="text-xs text-zinc-500">Analisamos apenas dados públicos, para entender padrões de formato e tom. Nada é copiado.</p>
            {analysis ? (
              <div className="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-zinc-800">
                <p className="font-medium">Padrões de {analysis.target}</p>
                <p className="mt-1">{analysis.summary}</p>
                <p className="mt-2 text-xs text-zinc-600">Vamos usar esses padrões no próximo carrossel que você criar (pelas abas Pautas, Meu tema ou De um link).</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="meus">
        <div className="flex items-center justify-between gap-3">
          <h2 id="meus" className="text-base font-semibold text-zinc-900">Meus carrosséis</h2>
        </div>
        {carousels.length === 0 ? <p className="mt-3 text-sm text-zinc-500">Quando você criar o primeiro, ele aparece aqui.</p> : null}
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {carousels.map((item) => {
            const status = STATUS_LABEL[item.status] ?? STATUS_LABEL.DRAFT;
            return (
              <li key={item.id} className="flex gap-3 rounded-lg border border-zinc-200 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de mídia do próprio usuário */}
                {item.coverUrl ? <img src={item.coverUrl} alt="" className="h-24 w-[76px] shrink-0 rounded-md object-cover" /> : <div className="h-24 w-[76px] shrink-0 rounded-md bg-zinc-100" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900">{item.title || item.topic}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
                    <span className={`rounded-full px-2 py-0.5 ${status.className}`}>{status.label}</span>
                    {item.slideCount} slides
                  </p>
                  {item.error ? <p className="mt-1 line-clamp-2 text-xs text-red-700">{item.error}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <LinkButton href={`/instagram/carrossel-inteligente/${item.id}`} variant="secondary" className="!min-h-9 !px-3 !py-1.5">Abrir</LinkButton>
                    <Button type="button" variant="ghost" className="!min-h-9 !px-3 !py-1.5" disabled={busy !== null} onClick={() => void run(`dup-${item.id}`, async () => { await projectAction(item.id, { action: "duplicate" }); await load(); })}>Duplicar</Button>
                    <Button type="button" variant="ghost" className="!min-h-9 !px-3 !py-1.5 !text-red-700" disabled={busy !== null} onClick={() => setToDelete(item)}>Excluir</Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir carrossel?"
        description="Essa ação não pode ser desfeita. Carrosséis já publicados continuam no Instagram."
        confirmLabel="Excluir"
        destructive
        busy={busy !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          const target = toDelete;
          if (!target) return;
          void run(`del-${target.id}`, async () => { await projectAction(target.id, { action: "delete" }); setToDelete(null); await load(); });
        }}
      />
    </div>
  );
}
