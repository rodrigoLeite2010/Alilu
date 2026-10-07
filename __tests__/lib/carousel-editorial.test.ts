// Carrossel Inteligente — Fase 3: regras editoriais puras + serviço com IA falsa (PGlite).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";
import * as rules from "@/lib/carousel/editorial/rules";
import * as prompts from "@/lib/carousel/editorial/prompts";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));

const svc = await import("@/lib/carousel/backend/carousel-editorial-service");
const projects = await import("@/lib/carousel/backend/carousel-project-service");
const repo = await import("@/lib/carousel/backend/carousel-repository");
const llmMod = await import("@/lib/carousel/backend/carousel-llm");
type CarouselLlm = import("@/lib/carousel/backend/carousel-llm").CarouselLlm;
type LlmRequest = import("@/lib/carousel/backend/carousel-llm").LlmRequest;
type LlmResponse = import("@/lib/carousel/backend/carousel-llm").LlmResponse;

const NOW = new Date("2026-10-07T12:00:00Z");
const FUTURE = "2026-11-07T12:00:00Z";

describe("regras puras", () => {
  it("detecta frases genéricas, ignorando acento e caixa", () => {
    expect(rules.findGenericPhrases("Você CONSEGUE! Nunca desista.")).toEqual(["você consegue", "nunca desista"]);
    expect(rules.findGenericPhrases("Planeje o orçamento do mês")).toEqual([]);
  });
  it("nichos sensíveis", () => {
    expect(rules.isSensitiveNiche("Educação financeira")).toBe(true);
    expect(rules.isSensitiveNiche("Nutrição esportiva")).toBe(true);
    expect(rules.isSensitiveNiche("Moda praia")).toBe(false);
  });
  it("copyOverlap alto para cópia e baixo para reescrita", () => {
    const src = "o planejamento financeiro começa quando você anota cada gasto do mês com disciplina";
    expect(rules.copyOverlap(src, src)).toBe(1);
    expect(rules.copyOverlap("anotar gastos diários ajuda a enxergar para onde o dinheiro vai", src)).toBeLessThan(rules.MAX_COPY_OVERLAP);
  });
  it("normaliza hashtags", () => {
    expect(rules.normalizeHashtags(["#Finanças", "financas", "dica rápida", "#ok!"])).toEqual(["#financas", "#dicarapida", "#ok"]);
  });
  it("aceita @perfil e URL, rejeita rotas do Instagram", () => {
    expect(rules.parseInstagramTarget("@Alilu.Tec")).toBe("alilu.tec");
    expect(rules.parseInstagramTarget("https://www.instagram.com/alilu.tec/")).toBe("alilu.tec");
    expect(rules.parseInstagramTarget("https://instagram.com/p")).toBeNull();
    expect(rules.parseInstagramTarget("não é perfil!")).toBeNull();
  });
  it("só aceita https público", () => {
    expect(rules.parsePublicHttpsUrl("https://exemplo.com.br/a")).not.toBeNull();
    for (const bad of ["http://exemplo.com", "https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.1", "https://user:pw@exemplo.com", "https://exemplo.com:8443", "ftp://x.com", "https://intranet"]) {
      expect(rules.parsePublicHttpsUrl(bad)).toBeNull();
    }
  });
  it("endereços privados", () => {
    for (const ip of ["10.1.2.3", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "::1", "fd00::1"]) expect(rules.isPrivateAddress(ip)).toBe(true);
    expect(rules.isPrivateAddress("8.8.8.8")).toBe(false);
  });
  it("htmlToText remove script e tags", () => {
    const out = rules.htmlToText("<html><title>Oi</title><script>x()</script><p>Texto &amp; mais</p></html>");
    expect(out.title).toBe("Oi");
    expect(out.text).toContain("Texto & mais");
    expect(out.text).not.toContain("x()");
  });
});

describe("parsers de prompts", () => {
  it("parseScript exige a quantidade e título", () => {
    const ok = { slides: Array.from({ length: 5 }, (_, i) => ({ headline: `T${i}`, body: "b", visualKind: "PHOTO", imageQuery: "desk" })) };
    expect(prompts.parseScript(ok, 5)).toHaveLength(5);
    expect(prompts.parseScript({ slides: ok.slides.slice(0, 4) }, 5)).toBeNull();
    expect(prompts.parseScript({ slides: [{ headline: "", body: "x" }, ...ok.slides.slice(1)] }, 5)).toBeNull();
  });
  it("parseScript nunca devolve IMAGE_AI", () => {
    const slides = prompts.parseScript({ slides: [{ headline: "a", visualKind: "IMAGE_AI" }] }, 1)!;
    expect(slides[0].visualKind).toBe("GRAPHIC");
  });
  it("parseResearch só mantém fato com fonte conhecida", () => {
    const r = prompts.parseResearch({ summary: "s", sources: [{ title: "A", url: "https://a.com/x" }], facts: [{ claim: "c1", sourceUrl: "https://a.com/x" }, { claim: "c2", sourceUrl: "https://inventada.com" }] })!;
    expect(r.facts.map((f) => f.sourceUrl)).toEqual(["https://a.com/x", null]);
  });
  it("parseSource rejeita http", () => {
    expect(prompts.parseSource({ title: "x", url: "http://a.com" })).toBeNull();
  });
  it("parseAnthropicPayload junta texto, busca e citações", () => {
    const out = llmMod.parseAnthropicPayload(
      { model: "m", content: [{ type: "text", text: "{}" }, { type: "web_search_tool_result", content: [{ url: "https://a.com/1", title: "A", page_age: "2 dias" }, { url: "http://x.com" }] }], usage: { input_tokens: 5, output_tokens: 6, server_tool_use: { web_search_requests: 2 } } },
      "fallback",
    );
    expect(out.webSearches).toBe(2);
    expect(out.citations.map((c) => c.url)).toEqual(["https://a.com/1"]);
  });
});

// ---------------------------------------------------------------------------
class FakeLlm implements CarouselLlm {
  provider = "fake";
  calls: LlmRequest[] = [];
  constructor(readonly handler: (req: LlmRequest, n: number) => Partial<LlmResponse> & { json?: unknown }) {}
  async complete(request: LlmRequest): Promise<LlmResponse> {
    this.calls.push(request);
    const r = this.handler(request, this.calls.length);
    return { text: r.text ?? JSON.stringify(r.json ?? {}), model: "fake-model", tokensInput: 10, tokensOutput: 20, webSearches: r.webSearches ?? 0, citations: r.citations ?? [] };
  }
}

function scriptJson(count: number, tag = "") {
  return { slides: Array.from({ length: count }, (_, i) => ({ headline: `Passo ${i + 1} ${tag}`.trim(), body: `Explicação ${i + 1} sobre orçamento ${tag}`, cta: i === count - 1 ? "Salve este post" : "", visualKind: i % 2 ? "PHOTO" : "GRAPHIC", imageQuery: i % 2 ? "budget desk" : null })) };
}

function router(extra: Partial<Record<string, () => unknown>> = {}) {
  return new FakeLlm((req) => {
    const p = req.prompt;
    if (p.includes('"topics"')) return extra.topics?.() ? { json: extra.topics() } : { json: { topics: [{ title: "Como montar um orçamento", summary: "s", engagementPotential: "HIGH", sources: [{ title: "BC", url: "https://bc.gov.br/a" }, { title: "Falsa", url: "https://inventada.com/x" }] }, { title: "Reserva de emergência", summary: "s2" }] }, webSearches: 1, citations: [{ title: "BC", url: "https://bc.gov.br/a", pageAge: null }] };
    if (p.includes('"facts"')) return { json: { summary: "Panorama", facts: [{ claim: "fato 1", sourceUrl: "https://bc.gov.br/a" }], sources: [{ title: "BC", url: "https://bc.gov.br/a" }, { title: "Falsa", url: "https://inventada.com/x" }], caution: null }, webSearches: 2, citations: [{ title: "BC", url: "https://bc.gov.br/a", pageAge: null }] };
    if (p.includes('"hooks"')) return { json: { hooks: [{ style: "ORIGINAL", headline: "O erro que drena seu orçamento" }, { style: "PROVOCATIVE", headline: "Você não controla seus gastos" }, { style: "AUTHORITY", headline: "O método dos planejadores" }] } };
    if (p.includes('"caption"')) return { json: { caption: "Legenda forte.\n\nSalve para depois.", hashtags: ["#Orcamento", "financas"] } };
    if (p.includes("SOMENTE o slide")) return { json: scriptJson(1, "novo") };
    const m = /EXATAMENTE (\d+) slides/.exec(p);
    return { json: scriptJson(Number(m?.[1] ?? 5)) };
  });
}

async function user(email: string): Promise<string> {
  const [row] = await db.sql`insert into users (email) values (${email}) returning id`;
  return row.id as string;
}
async function sub(userId: string) {
  await db.sql`insert into carousel_subscriptions (user_id, plan_code, status, list_price_cents, price_cents, current_period_ends_at) values (${userId}, 'STARTER', 'ACTIVE', 2990, 2990, ${FUTURE})`;
}
async function brand(userId: string, niche = "Educação financeira") {
  await repo.saveCarouselBrand(userId, { brandName: "Studio", handle: null, niche, audience: "autônomos", objective: null, tone: "direto", accentColor: null, secondaryColor: null, fontId: null, defaultTemplateId: null, logoUrl: null });
}

beforeEach(async () => {
  db = await createTestDb();
});
afterEach(async () => {
  await db.close();
  vi.clearAllMocks();
});

describe("pautas", () => {
  it("gera pautas, grava só fontes realmente consultadas e registra custo", async () => {
    const u = await user("a@x.com");
    await brand(u);
    const topics = await svc.suggestTopics(u, { mode: "TRENDS" }, { llm: router(), now: NOW });
    expect(topics).toHaveLength(2);
    const sources = await db.sql`select url from carousel_sources where topic_id = ${topics[0].id}`;
    expect(sources.map((s) => s.url)).toEqual(["https://bc.gov.br/a"]);
    const [usage] = await db.sql`select feature, web_searches from generation_usage where user_id = ${u}`;
    expect(usage.feature).toBe("carousel_topics");
    expect(Number(usage.web_searches)).toBe(1);
  });
  it("exige nicho e limita lotes por dia", async () => {
    const u = await user("b@x.com");
    await expect(svc.suggestTopics(u, { mode: "WEEKLY" }, { llm: router(), now: NOW })).rejects.toMatchObject({ code: "INVALID" });
    await brand(u);
    for (let i = 0; i < svc.EDITORIAL_LIMITS.topicBatchesPerDay; i += 1) {
      await svc.suggestTopics(u, { mode: "MANUAL", hint: `x${i}` }, { llm: new FakeLlm(() => ({ json: { topics: [{ title: `Pauta única número ${i}` }] } })), now: NOW });
    }
    await expect(svc.suggestTopics(u, { mode: "MANUAL" }, { llm: router(), now: NOW })).rejects.toMatchObject({ code: "LIMIT" });
  });
  it("cron semanal: só assinantes com nicho, uma vez por semana", async () => {
    const paying = await user("c@x.com");
    await sub(paying);
    await brand(paying);
    const free = await user("d@x.com");
    await brand(free);
    const llm = router();
    const first = await svc.generateWeeklyTopics({ llm, now: NOW });
    expect(first).toMatchObject({ processed: 1, generated: 2, failed: 0 });
    const second = await svc.generateWeeklyTopics({ llm, now: NOW });
    expect(second.processed).toBe(0);
    expect((await repo.listTopics(free)).length).toBe(0);
  });
  it("pauta vira projeto e fica USED", async () => {
    const u = await user("e@x.com");
    await brand(u);
    const [t] = await svc.suggestTopics(u, { mode: "TRENDS" }, { llm: router(), now: NOW });
    const project = await svc.createProjectFromTopic(u, t.id, { now: NOW });
    expect(project.sourceKind).toBe("SUGGESTED");
    expect(project.topicId).toBe(t.id);
    expect((await repo.listTopics(u)).find((x) => x.id === t.id)?.status).toBe("USED");
  });
  it("isolamento: outro usuário não usa a pauta", async () => {
    const a = await user("f@x.com");
    await brand(a);
    const [t] = await svc.suggestTopics(a, { mode: "TRENDS" }, { llm: router(), now: NOW });
    const b = await user("g@x.com");
    await expect(svc.createProjectFromTopic(b, t.id, { now: NOW })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("geração do carrossel", () => {
  it("gera pesquisa, ganchos, roteiro e legenda; fica READY e NÃO consome cota", async () => {
    const u = await user("h@x.com");
    await brand(u);
    const p = await projects.createCarouselProject({ userId: u, topic: "Orçamento mensal", slideCount: 8, includeEndMedia: false, now: NOW });
    const done = await svc.generateCarousel(u, p.id, { llm: router(), now: NOW });
    expect(done.status).toBe("READY");
    const slides = await repo.listSlides(p.id);
    expect(slides).toHaveLength(8);
    expect(slides[0].headline).toBe("O erro que drena seu orçamento");
    expect(done.caption).toContain("Legenda forte");
    expect(done.caption).toContain("não substitui"); // nicho sensível
    expect(done.hashtags).toEqual(["#orcamento", "#financas"]);
    const sources = await repo.listSources(p.id);
    expect(sources.map((s) => s.url)).toEqual(["https://bc.gov.br/a"]);
    expect(done.completedAt).toBeNull();
    expect((await db.sql`select count(*)::int as n from plan_usage_events`)[0].n).toBe(0);
  });
  it("com imagem final padrão, gera 1 slide a menos (cabe nos 10 itens)", async () => {
    const u = await user("i@x.com");
    await brand(u, "Moda");
    const p = await projects.createCarouselProject({ userId: u, topic: "Tendências", slideCount: 10, includeEndMedia: true, now: NOW });
    await svc.generateCarousel(u, p.id, { llm: router(), now: NOW });
    expect(await repo.listSlides(p.id)).toHaveLength(9);
  });
  it("nicho não sensível não recebe aviso", async () => {
    const u = await user("j@x.com");
    await brand(u, "Moda");
    const p = await projects.createCarouselProject({ userId: u, topic: "Cores do verão", slideCount: 5, now: NOW });
    const done = await svc.generateCarousel(u, p.id, { llm: router(), now: NOW });
    expect(done.caption).not.toContain("não substitui");
  });
  it("frase genérica provoca nova tentativa", async () => {
    const u = await user("k@x.com");
    await brand(u, "Moda");
    const p = await projects.createCarouselProject({ userId: u, topic: "Cores", slideCount: 5, now: NOW });
    let scriptCalls = 0;
    const base = router();
    const llm = new FakeLlm((req, n) => {
      if (/EXATAMENTE/.test(req.prompt)) {
        scriptCalls += 1;
        if (scriptCalls === 1) return { json: { slides: scriptJson(5).slides.map((s) => ({ ...s, body: "Você consegue, nunca desista" })) } };
      }
      return base.handler(req, n);
    });
    await svc.generateCarousel(u, p.id, { llm, now: NOW });
    expect(scriptCalls).toBe(2);
    expect((await repo.listSlides(p.id)).every((s) => !s.body.includes("nunca desista"))).toBe(true);
  });
  it("falha da IA → FAILED, nada cobrado, e dá para tentar de novo", async () => {
    const u = await user("l@x.com");
    await brand(u, "Moda");
    const p = await projects.createCarouselProject({ userId: u, topic: "Cores", slideCount: 5, now: NOW });
    const broken = new FakeLlm(() => {
      throw new Error("boom");
    });
    await expect(svc.generateCarousel(u, p.id, { llm: broken, now: NOW })).rejects.toBeTruthy();
    expect((await repo.getProject(u, p.id))?.status).toBe("FAILED");
    const ok = await svc.generateCarousel(u, p.id, { llm: router(), now: NOW });
    expect(ok.status).toBe("READY");
  });
  it("não gera duas vezes ao mesmo tempo", async () => {
    const u = await user("m@x.com");
    await brand(u, "Moda");
    const p = await projects.createCarouselProject({ userId: u, topic: "Cores", slideCount: 5, now: NOW });
    await repo.setProjectStatus(u, p.id, "GENERATING");
    await expect(svc.generateCarousel(u, p.id, { llm: router(), now: new Date() })).rejects.toMatchObject({ code: "BUSY" });
  });
  it("sem acesso (teste grátis usado, sem plano) bloqueia antes de gastar IA", async () => {
    const u = await user("n@x.com");
    await brand(u, "Moda");
    const p = await projects.createCarouselProject({ userId: u, topic: "Cores", slideCount: 5, now: NOW });
    await projects.saveProjectSlides(u, p.id, scriptJson(5).slides);
    await projects.completeCarouselProject(u, p.id, NOW);
    const p2 = await db.sql`insert into carousel_projects (user_id, topic) values (${u}, 'outro') returning id`;
    const llm = router();
    await expect(svc.generateCarousel(u, p2[0].id as string, { llm, now: NOW })).rejects.toMatchObject({ code: "ACCESS_DENIED" });
    expect(llm.calls).toHaveLength(0);
  });
  it("teto de chamadas de IA por projeto", async () => {
    const u = await user("o@x.com");
    await brand(u, "Moda");
    const p = await projects.createCarouselProject({ userId: u, topic: "Cores", slideCount: 5, now: NOW });
    for (let i = 0; i < svc.EDITORIAL_LIMITS.aiCallsPerProject; i += 1) {
      await repo.recordCarouselAiUsage({ userId: u, projectId: p.id, feature: "carousel_slide", provider: "fake", model: "m", tokensInput: 1, tokensOutput: 1, webSearches: 0 });
    }
    await expect(svc.generateCarousel(u, p.id, { llm: router(), now: NOW })).rejects.toMatchObject({ code: "LIMIT" });
  });
  it("gancho do usuário é preservado ao regerar", async () => {
    const u = await user("p@x.com");
    await brand(u, "Moda");
    const p = await projects.createCarouselProject({ userId: u, topic: "Cores", slideCount: 5, now: NOW });
    await svc.addCustomHook(u, p.id, "Meu gancho exato");
    await svc.generateCarousel(u, p.id, { llm: router(), now: NOW });
    expect((await repo.listSlides(p.id))[0].headline).toBe("Meu gancho exato");
  });
});

describe("slide e legenda isolados", () => {
  it("refaz só um slide e não mexe nos outros", async () => {
    const u = await user("q@x.com");
    await brand(u, "Moda");
    const p = await projects.createCarouselProject({ userId: u, topic: "Cores", slideCount: 5, now: NOW });
    await svc.generateCarousel(u, p.id, { llm: router(), now: NOW });
    const before = await repo.listSlides(p.id);
    await svc.regenerateSlide(u, p.id, 3, "mais prático", { llm: router() });
    const after = await repo.listSlides(p.id);
    expect(after[2].headline).toBe("Passo 1 novo");
    expect(after.filter((_, i) => i !== 2).map((s) => s.headline)).toEqual(before.filter((_, i) => i !== 2).map((s) => s.headline));
  });
  it("outro usuário não refaz slide alheio", async () => {
    const u = await user("r@x.com");
    await brand(u, "Moda");
    const p = await projects.createCarouselProject({ userId: u, topic: "Cores", slideCount: 5, now: NOW });
    await svc.generateCarousel(u, p.id, { llm: router(), now: NOW });
    const other = await user("s@x.com");
    await expect(svc.regenerateSlide(other, p.id, 1, null, { llm: router() })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("regenera a legenda", async () => {
    const u = await user("t@x.com");
    await brand(u, "Moda");
    const p = await projects.createCarouselProject({ userId: u, topic: "Cores", slideCount: 5, now: NOW });
    await svc.generateCarousel(u, p.id, { llm: router(), now: NOW });
    const updated = await svc.regenerateCaption(u, p.id, { llm: new FakeLlm(() => ({ json: { caption: "Outra legenda", hashtags: ["#a"] } })) });
    expect(updated?.caption).toBe("Outra legenda");
  });
});

describe("URL e perfil", () => {
  const SENTENCES = Array.from({ length: 12 }, (_, i) => `Etapa ${i} do planejamento mensal exige registrar entradas e saídas com regularidade ${i} e revisar categorias com calma ${i}`);
  const PAGE = `<html><title>Guia de orçamento</title><p>${SENTENCES.join(". ")}.</p></html>`;
  it("cria projeto a partir de URL pública e bloqueia cópia", async () => {
    const u = await user("u@x.com");
    await brand(u, "Moda");
    const p = await svc.createProjectFromUrl(u, "https://blog.exemplo.com/guia", { fetchPage: async () => PAGE, now: NOW });
    expect(p.sourceKind).toBe("URL");
    expect(p.topic).toBe("Guia de orçamento");
    const copying = new FakeLlm((req) => (/EXATAMENTE/.test(req.prompt) ? { json: { slides: Array.from({ length: 10 }, (_, i) => ({ headline: `Slide ${i}`, body: SENTENCES[i] })) } } : router().handler(req, 1)));
    await expect(svc.generateCarousel(u, p.id, { llm: copying, now: NOW })).rejects.toMatchObject({ code: "INVALID" });
    expect((await repo.getProject(u, p.id))?.status).toBe("FAILED");
  });
  it("rejeita URL privada sem chamar a rede", async () => {
    const u = await user("v@x.com");
    const fetchPage = vi.fn();
    await expect(svc.createProjectFromUrl(u, "https://127.0.0.1/x", { fetchPage })).rejects.toMatchObject({ code: "INVALID" });
    await expect(svc.createProjectFromUrl(u, "http://exemplo.com/x", { fetchPage })).rejects.toMatchObject({ code: "INVALID" });
    expect(fetchPage).not.toHaveBeenCalled();
  });
  it("página com pouco texto é recusada", async () => {
    const u = await user("w@x.com");
    await expect(svc.createProjectFromUrl(u, "https://blog.exemplo.com/a", { fetchPage: async () => "<p>oi</p>" })).rejects.toMatchObject({ code: "INVALID" });
  });
  it("analisa perfil público e guarda só padrões", async () => {
    const u = await user("x@x.com");
    const llm = new FakeLlm(() => ({ json: { found: true, themes: ["finanças"], structure: "gancho + lista", tone: "direto", hookFormats: ["pergunta"], summary: "Perfil educativo" }, webSearches: 2 }));
    const out = await svc.analyzePublicProfile(u, "https://instagram.com/Alilu.Tec", { llm, now: NOW });
    expect(out.target).toBe("alilu.tec");
    expect((await repo.getProfileAnalysis(u, out.id))?.patterns).toMatchObject({ tone: "direto" });
  });
  it("perfil inexistente / alvo inválido", async () => {
    const u = await user("y@x.com");
    await expect(svc.analyzePublicProfile(u, "???", { llm: router(), now: NOW })).rejects.toMatchObject({ code: "INVALID" });
    await expect(svc.analyzePublicProfile(u, "@naoexiste", { llm: new FakeLlm(() => ({ json: { found: false } })), now: NOW })).rejects.toMatchObject({ code: "INVALID" });
  });
  it("análise de perfil de outro usuário não anexa", async () => {
    const a = await user("z1@x.com");
    const analysis = await svc.analyzePublicProfile(a, "@perfil", { llm: new FakeLlm(() => ({ json: { found: true, summary: "x" } })), now: NOW });
    const b = await user("z2@x.com");
    const p = await projects.createCarouselProject({ userId: b, topic: "Tema", now: NOW });
    await expect(svc.attachProfileAnalysis(b, p.id, analysis.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
