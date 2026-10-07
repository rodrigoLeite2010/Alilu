import "server-only";
import { lookup } from "node:dns/promises";
import { CAROUSEL_LIMITS } from "../carousel-plans";
import { HOOK_STYLES, isoWeekKey, maxGeneratedSlides, type HookStyle } from "../domain";
import {
  buildCaptionPrompt,
  buildHooksPrompt,
  buildProfilePrompt,
  buildResearchPrompt,
  buildScriptPrompt,
  buildTopicsPrompt,
  CAROUSEL_SYSTEM_PROMPT,
  extractJson,
  hasDuplicateSlides,
  parseCaption,
  parseHooks,
  parseProfilePatterns,
  parseResearch,
  parseScript,
  parseTopics,
  patternsToPromptText,
  type BrandContext,
  type ResearchResult,
  type ScriptSlide,
  type SourceRef,
  type TopicsMode,
} from "../editorial/prompts";
import { copyOverlap, findGenericPhrases, htmlToText, isPrivateAddress, isSensitiveNiche, MAX_COPY_OVERLAP, parseInstagramTarget, parsePublicHttpsUrl } from "../editorial/rules";
import { getCarouselAccess } from "./carousel-access-service";
import { createCarouselLlmFromEnv, type CarouselLlm, type LlmCitation, type LlmRequest, type LlmResponse } from "./carousel-llm";
import { CarouselError, changeProjectStatus, createCarouselProject, failCarouselProject, requireProject, saveProjectSlides } from "./carousel-project-service";
import {
  chooseHook,
  clearGeneratedHooks,
  countProjectAiCalls,
  countTopicsForWeek,
  countUserAiCallsSince,
  getCarouselBrand,
  getProfileAnalysis,
  getTopic,
  insertHook,
  insertProfileAnalysis,
  insertSource,
  insertTopic,
  listHooks,
  listSlides,
  listSources,
  listTopics,
  listUsersNeedingWeeklyTopics,
  recordCarouselAiUsage,
  replaceProjectSources,
  setProjectResearch,
  setTopicStatus,
  updateProjectFields,
  type CarouselProjectRecord,
  type CarouselTopicRecord,
} from "./carousel-repository";

/** Tetos de custo/abuso (por projeto e por usuário). */
export const EDITORIAL_LIMITS = {
  aiCallsPerProject: 40,
  topicBatchesPerDay: 6,
  profileAnalysesPerDay: 5,
  topicsPerBatch: 6,
  weeklyTopics: 8,
  webSearchesTopics: 3,
  webSearchesResearch: 4,
  webSearchesProfile: 3,
  busyWindowMs: 3 * 60 * 1000,
} as const;

const SENSITIVE_DISCLAIMER = "Conteúdo informativo, não substitui a orientação de um profissional.";

export interface EditorialDeps {
  llm?: CarouselLlm;
  now?: Date;
  fetchPage?: (url: URL) => Promise<string>;
}

function getLlm(deps: EditorialDeps): CarouselLlm {
  if (deps.llm) return deps.llm;
  try {
    return createCarouselLlmFromEnv();
  } catch (error) {
    throw new CarouselError("AI_UNAVAILABLE", (error as Error).message);
  }
}

function todayLabel(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function brandContext(brand: Awaited<ReturnType<typeof getCarouselBrand>>, niche: string | null): BrandContext {
  return {
    brandName: brand?.brandName ?? null,
    niche: niche ?? brand?.niche ?? null,
    audience: brand?.audience ?? null,
    objective: brand?.objective ?? null,
    tone: brand?.tone ?? null,
  };
}

interface CallContext {
  userId: string;
  projectId: string | null;
  feature: string;
}

/** Chama a IA, registra tokens/buscas (custo) e devolve o JSON interpretado. */
async function callJson(llm: CarouselLlm, ctx: CallContext, request: Omit<LlmRequest, "system">): Promise<{ json: Record<string, unknown> | null; response: LlmResponse }> {
  let response: LlmResponse;
  try {
    response = await llm.complete({ ...request, system: CAROUSEL_SYSTEM_PROMPT });
  } catch (error) {
    throw new CarouselError("AI_UNAVAILABLE", error instanceof Error ? error.message : "Falha ao chamar a IA.");
  }
  await recordCarouselAiUsage({
    userId: ctx.userId,
    projectId: ctx.projectId,
    feature: `carousel_${ctx.feature}`,
    provider: llm.provider,
    model: response.model,
    tokensInput: response.tokensInput,
    tokensOutput: response.tokensOutput,
    webSearches: response.webSearches,
  });
  return { json: extractJson(response.text), response };
}

/** Só aceita fontes que a busca realmente consultou (a IA não pode inventar URL). */
export function verifiedSources(sources: SourceRef[], citations: LlmCitation[]): SourceRef[] {
  const real = new Map(citations.map((citation) => [citation.url, citation]));
  return sources.filter((source) => real.has(source.url)).map((source) => ({ ...source, title: source.title || real.get(source.url)?.title || source.url }));
}

async function assertCanUse(userId: string, now: Date): Promise<void> {
  const access = await getCarouselAccess(userId, now);
  if (!access.allowed) throw new CarouselError("ACCESS_DENIED", access.reason ?? "Sem acesso ao Carrossel Inteligente.", access);
}

async function assertProjectBudget(projectId: string): Promise<void> {
  if ((await countProjectAiCalls(projectId)) >= EDITORIAL_LIMITS.aiCallsPerProject) {
    throw new CarouselError("LIMIT", "Este carrossel atingiu o limite de gerações. Crie um novo carrossel para continuar.");
  }
}

// ---------------------------------------------------------------------------
// Pautas
// ---------------------------------------------------------------------------
export async function suggestTopics(userId: string, input: { mode: TopicsMode; hint?: string; niche?: string | null }, deps: EditorialDeps = {}): Promise<CarouselTopicRecord[]> {
  const now = deps.now ?? new Date();
  await assertCanUse(userId, now);
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if ((await countUserAiCallsSince(userId, "carousel_topics", since)) >= EDITORIAL_LIMITS.topicBatchesPerDay) {
    throw new CarouselError("LIMIT", "Você atingiu o limite de sugestões de pautas por hoje. Volte amanhã ou escolha um tema seu.");
  }
  return generateTopics(userId, input, { ...deps, now });
}

async function generateTopics(userId: string, input: { mode: TopicsMode; hint?: string; niche?: string | null }, deps: EditorialDeps): Promise<CarouselTopicRecord[]> {
  const now = deps.now ?? new Date();
  const llm = getLlm(deps);
  const brand = await getCarouselBrand(userId);
  const niche = input.niche ?? brand?.niche ?? null;
  if (!niche && input.mode !== "MANUAL") throw new CarouselError("INVALID", "Defina o nicho do seu perfil para receber pautas sugeridas.");
  const weekKey = isoWeekKey(now);
  const existing = await listTopics(userId);
  const { json, response } = await callJson(llm, { userId, projectId: null, feature: "topics" }, {
    prompt: buildTopicsPrompt({ mode: input.mode, brand: brandContext(brand, niche), count: EDITORIAL_LIMITS.topicsPerBatch, today: todayLabel(now), avoid: existing.map((topic) => topic.title), hint: input.hint }),
    maxOutputTokens: 2500,
    webSearchMax: input.mode === "MANUAL" ? 0 : EDITORIAL_LIMITS.webSearchesTopics,
  });
  const parsed = parseTopics(json, EDITORIAL_LIMITS.topicsPerBatch);
  if (parsed.length === 0) throw new CarouselError("AI_UNAVAILABLE", "Não consegui montar pautas agora. Tente novamente em instantes.");
  const known = new Set(existing.map((topic) => topic.title.toLowerCase()));
  const saved: CarouselTopicRecord[] = [];
  for (const topic of parsed) {
    if (known.has(topic.title.toLowerCase())) continue;
    const record = await insertTopic({ userId, weekKey, niche: niche ?? "geral", ...topic });
    for (const source of verifiedSources(topic.sources, response.citations)) await insertSource({ topicId: record.id }, { kind: "WEB", ...source });
    saved.push(record);
  }
  return saved;
}

/** Cron semanal: pautas para assinantes ativos com nicho. Idempotente por semana. */
export async function generateWeeklyTopics(options: { limit?: number } & EditorialDeps = {}): Promise<{ processed: number; generated: number; failed: number }> {
  const now = options.now ?? new Date();
  const weekKey = isoWeekKey(now);
  const users = await listUsersNeedingWeeklyTopics(weekKey, options.limit ?? 10);
  let generated = 0;
  let failed = 0;
  for (const user of users) {
    try {
      const topics = await generateTopics(user.userId, { mode: "WEEKLY", niche: user.niche }, { ...options, now });
      generated += topics.length;
      if ((await countTopicsForWeek(user.userId, weekKey)) === 0) failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { processed: users.length, generated, failed };
}

export async function dismissTopic(userId: string, topicId: string): Promise<boolean> {
  return setTopicStatus(userId, topicId, "DISMISSED");
}

/** Cria um projeto a partir de uma pauta sugerida. */
export async function createProjectFromTopic(userId: string, topicId: string, options: { slideCount?: number; instagramAccountId?: string | null; now?: Date } = {}): Promise<CarouselProjectRecord> {
  const topic = await getTopic(userId, topicId);
  if (!topic) throw new CarouselError("NOT_FOUND", "Pauta não encontrada.");
  const project = await createCarouselProject({ userId, topic: topic.title, sourceKind: "SUGGESTED", sourceRef: topic.id, topicId: topic.id, niche: topic.niche, slideCount: options.slideCount, instagramAccountId: options.instagramAccountId, now: options.now });
  await setTopicStatus(userId, topicId, "USED");
  const angle = [topic.summary, topic.narrativeAngle, topic.informativeAngle].filter(Boolean).join(" ");
  if (angle) await setProjectResearch(userId, project.id, { summary: angle, facts: [], sources: [], caution: null, seeded: true });
  return requireProject(userId, project.id);
}

// ---------------------------------------------------------------------------
// Leitura segura de URL (SSRF) e perfil público
// ---------------------------------------------------------------------------
const MAX_PAGE_BYTES = 1_500_000;
const PAGE_TIMEOUT_MS = 8000;

async function assertPublicHost(host: string): Promise<void> {
  const addresses = await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new CarouselError("INVALID", "Não consigo ler esse endereço.");
  }
}

/** Baixa HTML público: https, sem IP privado, redirecionamentos revalidados, tamanho e tempo limitados. */
export async function fetchPublicPage(start: URL): Promise<string> {
  let url = start;
  for (let hop = 0; hop < 4; hop += 1) {
    await assertPublicHost(url.hostname);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
    try {
      const response = await fetch(url, { redirect: "manual", signal: controller.signal, headers: { "user-agent": "AliluBot/1.0 (+https://alilu.com.br)", accept: "text/html" } });
      if (response.status >= 300 && response.status < 400) {
        const next = response.headers.get("location");
        const parsed = next ? parsePublicHttpsUrl(new URL(next, url).toString()) : null;
        if (!parsed) throw new CarouselError("INVALID", "Não consigo ler esse endereço.");
        url = parsed;
        continue;
      }
      if (!response.ok) throw new CarouselError("INVALID", "Não consegui abrir esse link.");
      if (!/text\/html|application\/xhtml/i.test(response.headers.get("content-type") ?? "")) throw new CarouselError("INVALID", "O link precisa ser uma página web (HTML).");
      const reader = response.body?.getReader();
      if (!reader) throw new CarouselError("INVALID", "Não consegui ler esse link.");
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (total < MAX_PAGE_BYTES) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        total += value.byteLength;
      }
      await reader.cancel().catch(() => undefined);
      return Buffer.concat(chunks).toString("utf8");
    } catch (error) {
      if (error instanceof CarouselError) throw error;
      throw new CarouselError("INVALID", "Não consegui abrir esse link.");
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new CarouselError("INVALID", "O link tem redirecionamentos demais.");
}

/** Projeto a partir de uma URL: o texto vira material de apoio (nunca é republicado). */
export async function createProjectFromUrl(userId: string, rawUrl: string, options: { slideCount?: number; now?: Date } & EditorialDeps = {}): Promise<CarouselProjectRecord> {
  const url = parsePublicHttpsUrl(rawUrl);
  if (!url) throw new CarouselError("INVALID", "Informe um link público começando com https://.");
  await assertCanUse(userId, options.now ?? new Date());
  const html = await (options.fetchPage ?? fetchPublicPage)(url);
  const page = htmlToText(html);
  if (page.text.length < 200) throw new CarouselError("INVALID", "Não encontrei texto suficiente nesse link para criar um carrossel.");
  const topic = page.title || `Conteúdo de ${url.hostname}`;
  const project = await createCarouselProject({ userId, topic: topic.slice(0, CAROUSEL_LIMITS.topic), sourceKind: "URL", sourceRef: url.toString(), slideCount: options.slideCount, now: options.now });
  await setProjectResearch(userId, project.id, { summary: "", facts: [], sources: [], caution: null, sourceText: page.text.slice(0, 6000) });
  await replaceProjectSources(project.id, [{ kind: "URL", title: page.title || url.hostname, url: url.toString(), publisher: url.hostname }]);
  return requireProject(userId, project.id);
}

/** Análise de padrões de um perfil PÚBLICO (só pesquisa web pública; sem login, sem cópia). */
export async function analyzePublicProfile(userId: string, rawTarget: string, deps: EditorialDeps = {}): Promise<{ id: string; target: string; summary: string }> {
  const now = deps.now ?? new Date();
  await assertCanUse(userId, now);
  const handle = parseInstagramTarget(rawTarget);
  if (!handle) throw new CarouselError("INVALID", "Informe um @perfil ou link público do Instagram.");
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if ((await countUserAiCallsSince(userId, "carousel_profile", since)) >= EDITORIAL_LIMITS.profileAnalysesPerDay) {
    throw new CarouselError("LIMIT", "Limite diário de análises de perfil atingido.");
  }
  const { json } = await callJson(getLlm(deps), { userId, projectId: null, feature: "profile" }, {
    prompt: buildProfilePrompt({ handle }),
    maxOutputTokens: 1200,
    webSearchMax: EDITORIAL_LIMITS.webSearchesProfile,
  });
  const patterns = parseProfilePatterns(json);
  if (!patterns || !patterns.found) throw new CarouselError("INVALID", "Não encontrei informações públicas suficientes sobre esse perfil.");
  const id = await insertProfileAnalysis(userId, handle, { ...patterns });
  return { id, target: handle, summary: patterns.summary };
}

export async function attachProfileAnalysis(userId: string, projectId: string, analysisId: string): Promise<void> {
  const project = await requireProject(userId, projectId);
  const analysis = await getProfileAnalysis(userId, analysisId);
  if (!analysis) throw new CarouselError("NOT_FOUND", "Análise não encontrada.");
  await setProjectResearch(userId, projectId, project.research, analysisId);
}

// ---------------------------------------------------------------------------
// Pesquisa, ganchos, roteiro e legenda
// ---------------------------------------------------------------------------
function readStoredResearch(project: CarouselProjectRecord): { research: ResearchResult | null; sourceText: string | null; seeded: boolean } {
  const stored = project.research as Record<string, unknown>;
  const research = parseResearch(stored);
  const sourceText = typeof stored.sourceText === "string" && stored.sourceText ? stored.sourceText : null;
  return { research, sourceText, seeded: stored.seeded === true };
}

export async function researchProject(userId: string, projectId: string, deps: EditorialDeps = {}): Promise<ResearchResult | null> {
  const now = deps.now ?? new Date();
  const project = await requireProject(userId, projectId);
  await assertProjectBudget(projectId);
  const brand = await getCarouselBrand(userId);
  const { sourceText } = readStoredResearch(project);
  const { json, response } = await callJson(getLlm(deps), { userId, projectId, feature: "research" }, {
    prompt: buildResearchPrompt({ topic: project.topic, brand: brandContext(brand, project.niche), today: todayLabel(now), slideCount: project.slideCount }),
    maxOutputTokens: 2000,
    webSearchMax: EDITORIAL_LIMITS.webSearchesResearch,
  });
  const parsed = parseResearch(json);
  if (!parsed) return null;
  const sources = verifiedSources(parsed.sources, response.citations);
  const urls = new Set(sources.map((source) => source.url));
  const facts = parsed.facts.map((fact) => ({ claim: fact.claim, sourceUrl: fact.sourceUrl && urls.has(fact.sourceUrl) ? fact.sourceUrl : null }));
  const caution = sources.length === 0 ? parsed.caution ?? "Não encontrei fontes confiáveis para confirmar os dados. Revise antes de publicar." : parsed.caution;
  const research: ResearchResult = { summary: parsed.summary, facts, sources, caution };
  await setProjectResearch(userId, projectId, { ...research, sourceText });
  await replaceProjectSources(projectId, [
    ...(project.sourceKind === "URL" && project.sourceRef ? [{ kind: "URL" as const, title: project.topic, url: project.sourceRef, publisher: new URL(project.sourceRef).hostname }] : []),
    ...sources.map((source) => ({ kind: "WEB" as const, ...source })),
  ]);
  return research;
}

export async function generateProjectHooks(userId: string, projectId: string, styles: HookStyle[] = ["ORIGINAL", "PROVOCATIVE", "AUTHORITY", "STORYTELLING"], deps: EditorialDeps = {}) {
  const project = await requireProject(userId, projectId);
  await assertProjectBudget(projectId);
  const brand = await getCarouselBrand(userId);
  const wanted = styles.filter((style) => style !== "CUSTOM" && (HOOK_STYLES as readonly string[]).includes(style));
  const { research } = readStoredResearch(project);
  const { json } = await callJson(getLlm(deps), { userId, projectId, feature: "hooks" }, {
    prompt: buildHooksPrompt({ topic: project.topic, brand: brandContext(brand, project.niche), research, wanted }),
    maxOutputTokens: 1200,
  });
  const hooks = parseHooks(json).filter((hook) => wanted.includes(hook.style));
  if (hooks.length === 0) throw new CarouselError("AI_UNAVAILABLE", "Não consegui criar ganchos agora. Tente novamente.");
  await clearGeneratedHooks(projectId);
  for (const hook of hooks) await insertHook(projectId, hook);
  return listHooks(projectId);
}

/** Gancho escrito pelo próprio usuário (estilo CUSTOM) já fica escolhido. */
export async function addCustomHook(userId: string, projectId: string, headline: string, subtitle?: string | null) {
  await requireProject(userId, projectId);
  const clean = headline.replace(/\s+/g, " ").trim().slice(0, CAROUSEL_LIMITS.headline);
  if (!clean) throw new CarouselError("INVALID", "Escreva o gancho.");
  const hook = await insertHook(projectId, { style: "CUSTOM", headline: clean, subtitle: subtitle?.trim().slice(0, 90) || null });
  await chooseHook(userId, projectId, hook.id);
  return hook;
}

async function writeScript(llm: CarouselLlm, ctx: CallContext, args: Parameters<typeof buildScriptPrompt>[0], sourceText: string | null): Promise<ScriptSlide[]> {
  let extra = args.extraInstruction ?? null;
  let last: ScriptSlide[] | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { json } = await callJson(llm, ctx, { prompt: buildScriptPrompt({ ...args, extraInstruction: extra }), maxOutputTokens: 3500 });
    const slides = parseScript(json, args.slideCount);
    if (!slides) {
      extra = `${args.extraInstruction ?? ""} Devolva exatamente ${args.slideCount} slides, todos com título.`.trim();
      continue;
    }
    last = slides;
    const joined = slides.map((slide) => `${slide.headline} ${slide.body}`).join(" ");
    const generic = findGenericPhrases(joined);
    const copied = sourceText ? copyOverlap(joined, sourceText) > MAX_COPY_OVERLAP : false;
    if (!generic.length && !hasDuplicateSlides(slides) && !copied) return slides;
    const notes: string[] = [];
    if (generic.length) notes.push(`Remova frases genéricas (${generic.join(", ")}) e use exemplos concretos.`);
    if (hasDuplicateSlides(slides)) notes.push("Não repita slides: cada um traz uma ideia nova.");
    if (copied) notes.push("O texto está parecido demais com o material de apoio: reescreva com outro ângulo e outras palavras.");
    extra = `${args.extraInstruction ?? ""} ${notes.join(" ")}`.trim();
  }
  if (!last) throw new CarouselError("AI_UNAVAILABLE", "Não consegui montar o roteiro agora. Tente novamente.");
  const joined = last.map((slide) => `${slide.headline} ${slide.body}`).join(" ");
  if (sourceText && copyOverlap(joined, sourceText) > MAX_COPY_OVERLAP) {
    throw new CarouselError("INVALID", "O conteúdo ficou parecido demais com o link original. Tente outro ângulo ou outro material.");
  }
  return last;
}

async function writeCaption(llm: CarouselLlm, ctx: CallContext, args: Parameters<typeof buildCaptionPrompt>[0], sensitive: boolean) {
  const { json } = await callJson(llm, ctx, { prompt: buildCaptionPrompt(args), maxOutputTokens: 1500 });
  const parsed = parseCaption(json);
  if (!parsed) return null;
  const caption = sensitive && !parsed.caption.includes(SENSITIVE_DISCLAIMER) ? `${parsed.caption}\n\n${SENSITIVE_DISCLAIMER}` : parsed.caption;
  return { caption: caption.slice(0, CAROUSEL_LIMITS.caption), hashtags: parsed.hashtags };
}

export interface GenerateCarouselOptions extends EditorialDeps {
  /** Refaz a pesquisa mesmo que o projeto já tenha uma. */
  refreshResearch?: boolean;
  extraInstruction?: string | null;
}

/**
 * Orquestra o carrossel inteiro: pesquisa → gancho → roteiro → legenda.
 * Nada é cobrado aqui (a cota só é consumida ao concluir). Qualquer falha
 * leva o projeto a FAILED com mensagem amigável; regerar é seguro.
 */
export async function generateCarousel(userId: string, projectId: string, options: GenerateCarouselOptions = {}): Promise<CarouselProjectRecord> {
  const now = options.now ?? new Date();
  let project = await requireProject(userId, projectId);
  if (project.status === "GENERATING" && now.getTime() - project.updatedAt.getTime() < EDITORIAL_LIMITS.busyWindowMs) {
    throw new CarouselError("BUSY", "Este carrossel já está sendo gerado. Aguarde alguns instantes.");
  }
  if (!project.completedAt) await assertCanUse(userId, now);
  await assertProjectBudget(projectId);
  const llm = getLlm(options);
  project = await changeProjectStatus(userId, projectId, "GENERATING");
  try {
    const brand = await getCarouselBrand(userId);
    const context = brandContext(brand, project.niche);
    const sensitive = isSensitiveNiche(context.niche) || isSensitiveNiche(project.topic);
    const ctx = (feature: string): CallContext => ({ userId, projectId, feature });

    const stored = readStoredResearch(project);
    const { sourceText, seeded } = stored;
    let research = stored.research;
    if (options.refreshResearch || !research || seeded) {
      try {
        research = (await researchProject(userId, projectId, { ...options, llm })) ?? research;
      } catch (error) {
        if (!(error instanceof CarouselError) || error.code !== "AI_UNAVAILABLE") throw error;
        research = research ?? null; // sem busca: segue sem fatos externos (o prompt proíbe inventar)
      }
    }

    let hooks = await listHooks(projectId);
    if (!hooks.some((hook) => hook.chosen)) {
      if (hooks.length === 0) hooks = await generateProjectHooks(userId, projectId, undefined, { ...options, llm });
      const first = hooks.find((hook) => hook.style === "ORIGINAL") ?? hooks[0];
      if (first) await chooseHook(userId, projectId, first.id);
    }
    const chosen = (await listHooks(projectId)).find((hook) => hook.chosen) ?? null;

    const slideCount = Math.min(project.slideCount, maxGeneratedSlides(project.includeEndMedia));
    let patternsText: string | null = null;
    if (project.profileAnalysisId) {
      const analysis = await getProfileAnalysis(userId, project.profileAnalysisId);
      const parsed = analysis ? parseProfilePatterns(analysis.patterns) : null;
      patternsText = parsed ? patternsToPromptText(parsed) : null;
    }

    const slides = await writeScript(
      llm,
      ctx("script"),
      { topic: project.topic, brand: context, research, hook: chosen ? { headline: chosen.headline, subtitle: chosen.subtitle } : null, slideCount, sourceText, profilePatterns: patternsText, extraInstruction: options.extraInstruction ?? null },
      sourceText,
    );
    if (chosen) {
      slides[0] = { ...slides[0], headline: chosen.headline, body: chosen.subtitle ?? slides[0].body };
    }
    await saveProjectSlides(userId, projectId, slides);

    const sourceTitles = (await listSources(projectId)).filter((source) => source.kind === "WEB").map((source) => source.title);
    const caption = await writeCaption(llm, ctx("caption"), { topic: project.topic, brand: context, slides, sourceTitles }, sensitive);
    await updateProjectFields(userId, projectId, {
      title: chosen?.headline ?? project.title,
      caption: caption?.caption ?? "",
      hashtags: caption?.hashtags ?? [],
    });
    return await changeProjectStatus(userId, projectId, "READY", { error: null });
  } catch (error) {
    const message = error instanceof CarouselError ? error.message : "Não foi possível gerar o carrossel agora. Nada foi cobrado; tente novamente.";
    await failCarouselProject(userId, projectId, message);
    throw error instanceof CarouselError ? error : new CarouselError("AI_UNAVAILABLE", message);
  }
}

/** Refaz UM slide (mantendo os demais). Não consome cota. */
export async function regenerateSlide(userId: string, projectId: string, position: number, instruction: string | null, deps: EditorialDeps = {}) {
  const project = await requireProject(userId, projectId);
  const slides = await listSlides(projectId);
  const target = slides.find((slide) => slide.position === position);
  if (!target) throw new CarouselError("NOT_FOUND", "Slide não encontrado.");
  await assertProjectBudget(projectId);
  const brand = await getCarouselBrand(userId);
  const { research, sourceText } = readStoredResearch(project);
  const others = slides.filter((slide) => slide.position !== position).map((slide) => `${slide.position}. ${slide.headline}`).join(" | ");
  const request = `Reescreva SOMENTE o slide ${position} (${target.role}) do carrossel "${project.topic}". Slides existentes: ${others}. Slide atual: "${target.headline}" — ${target.body}. ${instruction ? `Pedido do usuário: ${instruction}.` : "Traga um ângulo diferente, sem repetir os outros slides."}`;
  const count = Math.max(slides.length, CAROUSEL_LIMITS.minSlides);
  const { json } = await callJson(getLlm(deps), { userId, projectId, feature: "slide" }, {
    prompt: [
      ...(brand?.niche ? [`Nicho: ${brand.niche}`] : []),
      research?.summary ? `Pesquisa: ${research.summary}` : "",
      request,
      `Limites: título até ${CAROUSEL_LIMITS.headline}, corpo até ${CAROUSEL_LIMITS.body}. Não invente dados.`,
      'Formato JSON exato: {"slides":[{"headline":string,"body":string,"cta":string,"visualKind":"PHOTO"|"GRAPHIC"|"ILLUSTRATION","imageQuery":string|null}]}',
    ].filter(Boolean).join("\n"),
    maxOutputTokens: 600,
  });
  const parsed = parseScript(json, 1);
  if (!parsed) throw new CarouselError("AI_UNAVAILABLE", "Não consegui refazer o slide agora. Tente novamente.");
  const joined = `${parsed[0].headline} ${parsed[0].body}`;
  if (sourceText && copyOverlap(joined, sourceText) > MAX_COPY_OVERLAP) throw new CarouselError("INVALID", "O novo texto ficou parecido demais com o material de apoio. Tente outro pedido.");
  const next = slides.map((slide) => (slide.position === position ? { ...slide, ...parsed[0], cta: slide.position === count ? parsed[0].cta || slide.cta : slide.cta } : slide));
  return saveProjectSlides(userId, projectId, next.map((slide) => ({ headline: slide.headline, body: slide.body, cta: slide.cta, visualKind: slide.visualKind, imageQuery: slide.imageQuery, templateId: slide.templateId })));
}

export async function regenerateCaption(userId: string, projectId: string, deps: EditorialDeps = {}) {
  const project = await requireProject(userId, projectId);
  const slides = await listSlides(projectId);
  if (slides.length === 0) throw new CarouselError("INCOMPLETE", "Gere o roteiro antes da legenda.");
  await assertProjectBudget(projectId);
  const brand = await getCarouselBrand(userId);
  const context = brandContext(brand, project.niche);
  const titles = (await listSources(projectId)).filter((source) => source.kind === "WEB").map((source) => source.title);
  const caption = await writeCaption(getLlm(deps), { userId, projectId, feature: "caption" }, { topic: project.topic, brand: context, slides, sourceTitles: titles }, isSensitiveNiche(context.niche) || isSensitiveNiche(project.topic));
  if (!caption) throw new CarouselError("AI_UNAVAILABLE", "Não consegui criar a legenda agora. Tente novamente.");
  return updateProjectFields(userId, projectId, { caption: caption.caption, hashtags: caption.hashtags });
}
