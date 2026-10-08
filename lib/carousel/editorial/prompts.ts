/**
 * Prompts e validadores PUROS do Carrossel Inteligente (sem rede/banco).
 * Toda saída da IA passa por um parser que normaliza e descarta o que não
 * serve — a IA sugere, o código decide.
 */
import { HOOK_STYLES, HOOK_STYLE_LABEL, SLIDE_ROLE_LABEL, isVisualKind, slideRolesFor, type HookStyle, type SlideRole, type VisualKind } from "../domain";
import { CAROUSEL_LIMITS } from "../carousel-plans";
import { normalizeHashtags, isSensitiveNiche, GENERIC_PHRASES } from "./rules";

export const CAROUSEL_SYSTEM_PROMPT = [
  "Você é o editor de carrosséis da ALILU, marca brasileira de conteúdo que fala com pessoas comuns sobre psicologia, dinheiro, família, comportamento, motivação e curiosidades (e também de ferramentas úteis do dia a dia).",
  "Não presuma que o leitor é criador de conteúdo: só fale de criação de conteúdo, redes sociais, Instagram, roteiros ou produtividade de criador quando o TEMA indicado pedir isso explicitamente.",
  "Escreva sempre em português do Brasil, com linguagem natural e específica.",
  "Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto antes ou depois.",
  "Nunca invente dados, números, datas, leis, estudos ou citações. Se não houver fonte, não afirme como fato.",
  "Nunca copie textos de terceiros: reescreva com suas palavras e ângulo próprio.",
  "Nunca prometa viralização, ganho de seguidores ou resultado garantido.",
  `Evite frases motivacionais vazias como: ${GENERIC_PHRASES.map((phrase) => `"${phrase}"`).join(", ")}.`,
].join(" ");

export interface BrandContext {
  brandName?: string | null;
  niche?: string | null;
  audience?: string | null;
  objective?: string | null;
  tone?: string | null;
}

function brandLines(brand: BrandContext): string[] {
  const lines: string[] = [];
  if (brand.brandName) lines.push(`Marca/perfil: ${brand.brandName}`);
  if (brand.niche) lines.push(`Nicho: ${brand.niche}`);
  if (brand.audience) lines.push(`Público: ${brand.audience}`);
  if (brand.objective) lines.push(`Objetivo do perfil: ${brand.objective}`);
  if (brand.tone) lines.push(`Tom de voz: ${brand.tone}`);
  return lines;
}

function sensitiveLine(niche: string | null | undefined): string[] {
  return isSensitiveNiche(niche)
    ? ["ATENÇÃO: nicho sensível (saúde, finanças ou direito). Só afirme o que tiver fonte; use linguagem prudente e inclua aviso de que não substitui um profissional."]
    : [];
}

// ---------------------------------------------------------------------------
// Utilitários de parsing
// ---------------------------------------------------------------------------
export function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function str(value: unknown, max = 500): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export interface SourceRef {
  title: string;
  url: string;
  publisher: string | null;
  publishedAt: Date | null;
}

export function parseSource(value: unknown): SourceRef | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const url = str(record.url, 600);
  if (!/^https:\/\/[^\s]+\.[^\s]+/i.test(url)) return null;
  const date = typeof record.publishedAt === "string" ? new Date(record.publishedAt) : null;
  return {
    title: str(record.title, 200) || url,
    url,
    publisher: str(record.publisher, 120) || null,
    publishedAt: date && !Number.isNaN(date.getTime()) ? date : null,
  };
}

// ---------------------------------------------------------------------------
// Pautas
// ---------------------------------------------------------------------------
export interface TopicSuggestion {
  title: string;
  summary: string;
  category: string | null;
  relevanceReason: string | null;
  narrativeAngle: string | null;
  informativeAngle: string | null;
  engagementPotential: "LOW" | "MEDIUM" | "HIGH";
  sources: SourceRef[];
}

export type TopicsMode = "WEEKLY" | "TRENDS" | "MANUAL";

export function buildTopicsPrompt(input: { mode: TopicsMode; brand: BrandContext; count: number; today: string; avoid: string[]; hint?: string }): string {
  const intent =
    input.mode === "TRENDS"
      ? "Pesquise na web o que está em alta AGORA no nicho (notícias, debates, datas e novidades) e proponha pautas atuais."
      : input.mode === "WEEKLY"
        ? "Pesquise na web novidades e assuntos relevantes da semana para o nicho e proponha pautas para a próxima semana."
        : `Proponha pautas a partir do pedido do usuário: ${input.hint ?? "(sem pedido específico)"}.`;
  return [
    `Data de hoje: ${input.today}.`,
    ...brandLines(input.brand),
    ...sensitiveLine(input.brand.niche),
    intent,
    input.avoid.length ? `NÃO repita estes temas já sugeridos ou usados: ${input.avoid.slice(0, 20).join(" | ")}.` : "",
    `Gere ${input.count} pautas, cada uma com ângulo próprio e útil para o público. Cite fontes reais (https) quando a pauta depender de fato externo.`,
    'Formato JSON exato: {"topics":[{"title":string (até 90),"summary":string (até 220),"category":string,"relevanceReason":string (por que importa agora, até 160),"narrativeAngle":string (até 140),"informativeAngle":string (até 140),"engagementPotential":"LOW"|"MEDIUM"|"HIGH","sources":[{"title":string,"url":string,"publisher":string,"publishedAt":"AAAA-MM-DD"}]}]}',
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseTopics(json: Record<string, unknown> | null, max: number): TopicSuggestion[] {
  if (!json) return [];
  const seen = new Set<string>();
  const out: TopicSuggestion[] = [];
  for (const raw of arr(json.topics)) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const title = str(record.title, 90);
    if (title.length < 5) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const potential = record.engagementPotential;
    out.push({
      title,
      summary: str(record.summary, 220),
      category: str(record.category, 40) || null,
      relevanceReason: str(record.relevanceReason, 160) || null,
      narrativeAngle: str(record.narrativeAngle, 140) || null,
      informativeAngle: str(record.informativeAngle, 140) || null,
      engagementPotential: potential === "HIGH" || potential === "LOW" ? potential : "MEDIUM",
      sources: arr(record.sources).map(parseSource).filter((source): source is SourceRef => source !== null).slice(0, 4),
    });
    if (out.length >= max) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pesquisa
// ---------------------------------------------------------------------------
export interface ResearchResult {
  summary: string;
  facts: Array<{ claim: string; sourceUrl: string | null }>;
  sources: SourceRef[];
  /** Aviso de cautela quando faltou fonte (aparece para o usuário). */
  caution: string | null;
}

export function buildResearchPrompt(input: { topic: string; brand: BrandContext; today: string; slideCount: number; directive?: string | null }): string {
  return [
    `Data de hoje: ${input.today}.`,
    ...brandLines(input.brand),
    ...sensitiveLine(input.brand.niche),
    input.directive ? `${input.directive}\nPesquise sobre o TEMA acima (e não sobre carrosséis, redes sociais ou criação de conteúdo).` : "",
    `Tema do carrossel: ${input.topic}`,
    "Pesquise na web fontes confiáveis e recentes sobre o tema. Extraia fatos verificáveis, cada um ligado a uma fonte. Não copie frases: resuma com suas palavras.",
    `O carrossel terá ${input.slideCount} slides, então traga fatos suficientes (de 4 a 8) e um resumo curto do panorama.`,
    'Formato JSON exato: {"summary":string (até 500),"facts":[{"claim":string (até 200),"sourceUrl":string}],"sources":[{"title":string,"url":string,"publisher":string,"publishedAt":"AAAA-MM-DD"}],"caution":string|null (se faltou fonte confiável, diga o que não pôde ser confirmado)}',
  ].join("\n");
}

export function parseResearch(json: Record<string, unknown> | null): ResearchResult | null {
  if (!json) return null;
  const sources = arr(json.sources).map(parseSource).filter((source): source is SourceRef => source !== null).slice(0, 8);
  const knownUrls = new Set(sources.map((source) => source.url));
  const facts = arr(json.facts)
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const record = raw as Record<string, unknown>;
      const claim = str(record.claim, 200);
      if (!claim) return null;
      const url = str(record.sourceUrl, 600);
      return { claim, sourceUrl: url && knownUrls.has(url) ? url : null };
    })
    .filter((fact): fact is { claim: string; sourceUrl: string | null } => fact !== null)
    .slice(0, 10);
  const summary = str(json.summary, 500);
  if (!summary && facts.length === 0) return null;
  return { summary, facts, sources, caution: str(json.caution, 300) || null };
}

// ---------------------------------------------------------------------------
// Ganchos
// ---------------------------------------------------------------------------
export interface HookSuggestion {
  style: HookStyle;
  headline: string;
  subtitle: string | null;
  objective: string | null;
}

export function buildHooksPrompt(input: { topic: string; brand: BrandContext; research: ResearchResult | null; wanted: HookStyle[]; directive?: string | null }): string {
  return [
    ...brandLines(input.brand),
    input.directive ?? "",
    `Tema: ${input.topic}`,
    input.research?.summary ? `Resumo da pesquisa: ${input.research.summary}` : "",
    `Crie um gancho (primeiro slide) para cada estilo: ${input.wanted.map((style) => `${style} (${HOOK_STYLE_LABEL[style]})`).join(", ")}.`,
    "Regras: título de até 70 caracteres, claro e específico; nada de clickbait enganoso nem promessa de viralização; subtítulo opcional de até 90.",
    'Formato JSON exato: {"hooks":[{"style":"ORIGINAL"|"PROVOCATIVE"|"AUTHORITY"|"STORYTELLING","headline":string,"subtitle":string|null,"objective":string (o que o gancho promete entregar)}]}',
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseHooks(json: Record<string, unknown> | null): HookSuggestion[] {
  if (!json) return [];
  const seen = new Set<HookStyle>();
  const out: HookSuggestion[] = [];
  for (const raw of arr(json.hooks)) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const style = (HOOK_STYLES as readonly string[]).includes(record.style as string) ? (record.style as HookStyle) : null;
    const headline = str(record.headline, CAROUSEL_LIMITS.headline);
    if (!style || style === "CUSTOM" || !headline || seen.has(style)) continue;
    seen.add(style);
    out.push({ style, headline, subtitle: str(record.subtitle, 90) || null, objective: str(record.objective, 160) || null });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Roteiro
// ---------------------------------------------------------------------------
export interface ScriptSlide {
  headline: string;
  body: string;
  cta: string;
  visualKind: VisualKind;
  imageQuery: string | null;
}

export function buildScriptPrompt(input: {
  topic: string;
  brand: BrandContext;
  research: ResearchResult | null;
  hook: { headline: string; subtitle: string | null } | null;
  slideCount: number;
  sourceText?: string | null;
  profilePatterns?: string | null;
  extraInstruction?: string | null;
  directive?: string | null;
}): string {
  const roles: SlideRole[] = slideRolesFor(input.slideCount);
  return [
    ...brandLines(input.brand),
    ...sensitiveLine(input.brand.niche),
    input.directive ?? "",
    `Tema: ${input.topic}`,
    input.hook ? `Gancho escolhido (slide 1): "${input.hook.headline}"${input.hook.subtitle ? ` — ${input.hook.subtitle}` : ""}` : "",
    input.research
      ? `Pesquisa:\n${input.research.summary}\n${input.research.facts.map((fact) => `- ${fact.claim}`).join("\n")}`
      : "Sem pesquisa externa: não cite números, datas ou estudos específicos.",
    input.sourceText ? `Material de apoio (apenas inspiração de conteúdo; reescreva tudo com suas palavras e outro ângulo):\n${input.sourceText.slice(0, 3500)}` : "",
    input.profilePatterns ? `Padrões editoriais observados (use só como referência de estrutura, nunca copie frases): ${input.profilePatterns}` : "",
    input.extraInstruction ? `Instrução do usuário: ${input.extraInstruction}` : "",
    `Escreva EXATAMENTE ${input.slideCount} slides, na ordem e papéis: ${roles.map((role, index) => `${index + 1}=${SLIDE_ROLE_LABEL[role]}`).join(", ")}.`,
    `Limites: título até ${CAROUSEL_LIMITS.headline} caracteres; corpo até ${CAROUSEL_LIMITS.body} caracteres, uma ideia por slide, progressão lógica, sem repetir slides; o último slide traz uma chamada para ação natural no campo cta (até 40 caracteres); nos demais, cta vazio.`,
    "visualKind: PHOTO (cena real), GRAPHIC (texto/dado em destaque) ou ILLUSTRATION. Em PHOTO, imageQuery é uma busca em inglês (3 a 5 palavras) por uma cena concreta de banco de imagens que ilustre o que ESTE slide diz (não repita o título; cada slide com uma cena diferente).",
    'Formato JSON exato: {"slides":[{"headline":string,"body":string,"cta":string,"visualKind":"PHOTO"|"GRAPHIC"|"ILLUSTRATION","imageQuery":string|null}]}',
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseScript(json: Record<string, unknown> | null, expected: number): ScriptSlide[] | null {
  if (!json) return null;
  const rawSlides = arr(json.slides);
  if (rawSlides.length < expected) return null;
  const slides: ScriptSlide[] = [];
  for (const raw of rawSlides.slice(0, expected)) {
    if (!raw || typeof raw !== "object") return null;
    const record = raw as Record<string, unknown>;
    const headline = str(record.headline, CAROUSEL_LIMITS.headline);
    if (!headline) return null;
    const visualKind: VisualKind = isVisualKind(record.visualKind) && record.visualKind !== "IMAGE_AI" && record.visualKind !== "NONE" ? record.visualKind : "GRAPHIC";
    slides.push({
      headline,
      body: str(record.body, CAROUSEL_LIMITS.body),
      cta: str(record.cta, 40),
      visualKind,
      imageQuery: visualKind === "PHOTO" ? str(record.imageQuery, 80) || null : null,
    });
  }
  return slides;
}

/** Slides repetidos (mesmo título) indicam roteiro ruim → vale uma nova tentativa. */
export function hasDuplicateSlides(slides: ScriptSlide[]): boolean {
  const seen = new Set<string>();
  for (const slide of slides) {
    const key = slide.headline.toLowerCase();
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Legenda
// ---------------------------------------------------------------------------
export function buildCaptionPrompt(input: { topic: string; brand: BrandContext; slides: Array<{ headline: string; body: string }>; sourceTitles: string[]; directive?: string | null }): string {
  return [
    ...brandLines(input.brand),
    ...sensitiveLine(input.brand.niche),
    input.directive ?? "",
    `Tema: ${input.topic}`,
    `Resumo dos slides:\n${input.slides.map((slide, index) => `${index + 1}. ${slide.headline} — ${slide.body}`).join("\n")}`,
    input.sourceTitles.length ? `Fontes usadas (cite de forma natural no final, sem links): ${input.sourceTitles.slice(0, 4).join("; ")}` : "",
    "Escreva a legenda do post: primeira linha forte, 2 a 4 parágrafos curtos, chamada para ação natural (salvar, comentar ou compartilhar) e de 6 a 12 hashtags relevantes à CATEGORIA e ao TEMA acima (sem repetir, sem hashtags enganosas, sem hashtags de criação de conteúdo quando o tema não for esse). Sem promessa de viralização.",
    'Formato JSON exato: {"caption":string (até 1800 caracteres, com quebras de linha),"hashtags":string[]}',
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseCaption(json: Record<string, unknown> | null): { caption: string; hashtags: string[] } | null {
  if (!json || typeof json.caption !== "string") return null;
  const caption = json.caption.replace(/\r/g, "").trim().slice(0, 2000);
  if (!caption) return null;
  return { caption, hashtags: normalizeHashtags(json.hashtags, 15) };
}

// ---------------------------------------------------------------------------
// Análise de perfil público e de URL
// ---------------------------------------------------------------------------
export function buildProfilePrompt(input: { handle: string }): string {
  return [
    `Pesquise na web, usando SOMENTE informações públicas, o perfil de Instagram @${input.handle}: tipo de conteúdo, temas recorrentes, estrutura típica dos carrosséis, tom de voz e formatos de gancho.`,
    "Não acesse nada privado, não tente identificar pessoas, e não copie textos: descreva padrões editoriais em termos gerais.",
    'Se não encontrar informação pública suficiente, devolva "found": false.',
    'Formato JSON exato: {"found":boolean,"themes":string[],"structure":string,"tone":string,"hookFormats":string[],"summary":string (até 400)}',
  ].join("\n");
}

export interface ProfilePatterns {
  found: boolean;
  themes: string[];
  structure: string;
  tone: string;
  hookFormats: string[];
  summary: string;
}

export function parseProfilePatterns(json: Record<string, unknown> | null): ProfilePatterns | null {
  if (!json) return null;
  const list = (value: unknown) => arr(value).map((item) => str(item, 80)).filter(Boolean).slice(0, 8);
  return {
    found: json.found !== false,
    themes: list(json.themes),
    structure: str(json.structure, 300),
    tone: str(json.tone, 120),
    hookFormats: list(json.hookFormats),
    summary: str(json.summary, 400),
  };
}

export function patternsToPromptText(patterns: ProfilePatterns): string {
  return [patterns.summary, patterns.structure && `Estrutura: ${patterns.structure}`, patterns.tone && `Tom: ${patterns.tone}`, patterns.hookFormats.length ? `Ganchos: ${patterns.hookFormats.join(", ")}` : ""]
    .filter(Boolean)
    .join(" ")
    .slice(0, 800);
}
