// @vitest-environment node
//
// Radar Viral — módulos puros: Viral Score, relevância, critérios, direitos,
// reabastecimento, prioridade, feeds RSS/Atom, configuração, saneamento da
// IA, adaptação 9:16, etapas e comparação de desempenho.
import { describe, expect, it } from "vitest";
import { computeViralScore, normalizeWeights, velocityReference, viewsVelocity, SCORE_FORMULA_VERSION, type MetricObservation } from "@/lib/viral-radar/score";
import { ruleRelevance, themeTerms } from "@/lib/viral-radar/relevance";
import {
  authorizationFromSource,
  decideRoute,
  failsCriteria,
  failureBackoffMinutes,
  normalizeCandidateUrl,
  orderByPriority,
  planRefill,
  queueIsStocked,
  refillCooldownMinutes,
} from "@/lib/viral-radar/selection";
import { parseFeed, FeedParseError } from "@/lib/viral-radar/rss";
import { defaultSettings, normalizeSettings, normalizeSource, RadarConfigError } from "@/lib/viral-radar/config";
import { sanitizeBrief, sanitizeCaption, sanitizeClassification, softenClaims } from "@/lib/viral-radar/ai-prompts";
import { buildReframeArgs, planReframe } from "@/lib/video-queue/reframe";
import { pipelineStage } from "@/lib/viral-radar/stage";
import { buildPerformanceReport } from "@/lib/viral-radar/insights";
import { DEFAULT_CRITERIA, DEFAULT_SCORE_WEIGHTS, GTA6_KEYWORDS } from "@/lib/viral-radar/types";

const NOW = new Date("2026-11-16T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const obs = (h: number, views: number | null, likes: number | null = null, comments: number | null = null): MetricObservation => ({ observedAt: hoursAgo(h), views, likes, comments });

describe("Viral Score", () => {
  it("não inventa velocidade com uma única observação e trata views totais como total (não por hora)", () => {
    const result = computeViralScore({ observations: [obs(0, 1_000_000, 50_000, 2_000)], publishedAt: hoursAgo(10), relevance: 1, now: NOW });
    const velocity = result.components.find((item) => item.key === "velocity")!;
    expect(velocity.value).toBeNull();
    expect(velocity.note).toMatch(/2ª observação/);
    expect(viewsVelocity([obs(0, 1_000_000)])).toBeNull();
    expect(result.coverage).toBeCloseTo(0.65, 5);
    expect(result.score).not.toBeNull();
    expect(result.version).toBe(SCORE_FORMULA_VERSION);
  });

  it("calcula crescimento real com duas observações separadas ≥ 30 min", () => {
    const velocity = viewsVelocity([obs(6, 100_000), obs(0, 160_000)]);
    expect(velocity?.perHour).toBeCloseTo(10_000, 5);
    // Menos de 30 min entre as observações: sem velocidade.
    expect(viewsVelocity([obs(0.2, 100_000), obs(0, 160_000)])).toBeNull();
    // Contador corrigido para baixo: crescimento zero, nunca negativo.
    expect(viewsVelocity([obs(2, 500), obs(0, 400)])?.perHour).toBe(0);
  });

  it("evita divisão por zero e amostra pequena; métricas indisponíveis ficam explícitas", () => {
    const result = computeViralScore({ observations: [obs(1, 0, 0, 0), obs(0, 100, 10, 1)], publishedAt: null, relevance: null, now: NOW });
    expect(result.components.find((item) => item.key === "likeRate")!.value).toBeNull();
    expect(result.components.find((item) => item.key === "likeRate")!.note).toMatch(/amostra pequena/);
    expect(result.components.find((item) => item.key === "recency")!.value).toBeNull();
    expect(Number.isFinite(result.score ?? 0)).toBe(true);
    const none = computeViralScore({ observations: [], publishedAt: null, relevance: null, now: NOW });
    expect(none.score).toBeNull();
    expect(none.reason).toMatch(/Dados insuficientes/);
  });

  it("escala log + referência p90 impede que um canal gigante domine", () => {
    const reference = velocityReference([100, 200, 300, 400, 500, 600, 700, 800, 900, 5_000_000]);
    expect(reference).toBeLessThan(5_000_000);
    const small = computeViralScore({ observations: [obs(6, 10_000, 600, 60), obs(0, 16_000, 960, 96)], publishedAt: hoursAgo(8), relevance: 1, now: NOW }, DEFAULT_SCORE_WEIGHTS, reference);
    const giant = computeViralScore({ observations: [obs(6, 50_000_000, 500_000, 5_000), obs(0, 80_000_000, 800_000, 8_000)], publishedAt: hoursAgo(8), relevance: 1, now: NOW }, DEFAULT_SCORE_WEIGHTS, reference);
    // O gigante tem engajamento proporcional MENOR: não vence só pelo tamanho.
    expect(small.score!).toBeGreaterThan(giant.score!);
  });

  it("pesos configuráveis precisam somar 100", () => {
    expect(normalizeWeights({ velocity: 50, likeRate: 10, commentRate: 10, recency: 15, relevance: 15 }).velocity).toBe(50);
    expect(() => normalizeWeights({ velocity: 50 })).toThrow(/somar 100/);
    expect(normalizeWeights(null)).toEqual(DEFAULT_SCORE_WEIGHTS);
  });
});

describe("relevância por regras", () => {
  const terms = themeTerms("gta-6", ["GTA 6 Brasil"], ["#GTA6"]);
  it("termo no título vale mais que na descrição; acentos e caixa ignorados", () => {
    expect(ruleRelevance({ title: "Detalhes escondidos no trailer de GTA VI", description: null }, terms)).toBeGreaterThanOrEqual(0.7);
    expect(ruleRelevance({ title: "Top 10 jogos", description: "inclui gta 6" }, terms)).toBeCloseTo(0.4);
    expect(ruleRelevance({ title: "Receita de bolo", description: "sem jogos" }, terms)).toBe(0);
  });
});

describe("critérios, direitos e destinos", () => {
  it("aplica mínimos, idade e score; métrica indisponível reprova só terceiros", () => {
    const base = { views: 150_000, likes: 1000, comments: 10, publishedAt: hoursAgo(10), score: 50, authorized: false };
    expect(failsCriteria(base, DEFAULT_CRITERIA, NOW)).toBeNull();
    expect(failsCriteria({ ...base, views: 99_999 }, DEFAULT_CRITERIA, NOW)).toMatch(/Visualizações/);
    expect(failsCriteria({ ...base, views: null }, DEFAULT_CRITERIA, NOW)).toMatch(/indisponíveis/);
    expect(failsCriteria({ ...base, views: null, authorized: true }, DEFAULT_CRITERIA, NOW)).toBeNull();
    expect(failsCriteria({ ...base, publishedAt: hoursAgo(24 * 30) }, DEFAULT_CRITERIA, NOW)).toMatch(/antigo/);
    expect(failsCriteria({ ...base, score: 10 }, DEFAULT_CRITERIA, NOW)).toMatch(/Viral Score/);
    expect(failsCriteria({ ...base, score: null }, DEFAULT_CRITERIA, NOW)).toMatch(/indisponível/);
  });

  it("público nunca é autorizado; licença precisa de declaração e escopo completo", () => {
    expect(authorizationFromSource(null).status).toBe("NOT_AUTHORIZED");
    expect(authorizationFromSource({ license: "NONE", scope: null, declaredAt: NOW }).status).toBe("NOT_AUTHORIZED");
    expect(authorizationFromSource({ license: "LICENSED", scope: { edit: true, republish: true, commercial: false }, declaredAt: NOW }).status).toBe("PENDING_REVIEW");
    expect(authorizationFromSource({ license: "OWN", scope: { edit: true, republish: true, commercial: true }, declaredAt: null }).status).toBe("PENDING_REVIEW");
    expect(authorizationFromSource({ license: "OWN", scope: { edit: true, republish: true, commercial: true }, declaredAt: NOW })).toMatchObject({ status: "AUTHORIZED", type: "OWN" });
  });

  it("destinos A/B/C conforme modos", () => {
    expect(decideRoute("AUTHORIZED", { autoMode: true, supervisedMode: true })).toEqual({ route: "A", status: "ELIGIBLE" });
    expect(decideRoute("AUTHORIZED", { autoMode: false, supervisedMode: true }).route).toBe("C");
    expect(decideRoute("NOT_AUTHORIZED", { autoMode: true, supervisedMode: true })).toEqual({ route: "C", status: "AWAITING_AUTHORIZATION" });
    expect(decideRoute("NOT_AUTHORIZED", { autoMode: true, supervisedMode: false })).toEqual({ route: "B", status: "REFERENCE" });
    expect(decideRoute("PENDING_REVIEW", { autoMode: true, supervisedMode: false }).route).toBe("C");
  });

  it("reabastecimento: abaixo do mínimo completa até o ideal; fila cheia não pesquisa; espera cresce sem resultados", () => {
    expect(planRefill({ ready: 2, inPipeline: 1, scheduled: 4 }, 5, 15)).toEqual({ available: 3, needsRefill: true, slots: 8 });
    expect(planRefill({ ready: 10, inPipeline: 0, scheduled: 5 }, 5, 15)).toEqual({ available: 10, needsRefill: false, slots: 0 });
    expect(queueIsStocked({ ready: 10, inPipeline: 2, scheduled: 3 }, 15)).toBe(true);
    expect(refillCooldownMinutes(0, 360)).toBe(30);
    expect(refillCooldownMinutes(3, 360)).toBe(240);
    expect(refillCooldownMinutes(10, 360)).toBe(360);
    expect(failureBackoffMinutes(1)).toBe(15);
    expect(failureBackoffMinutes(20)).toBe(24 * 60);
  });

  it("prioridade por score com envelhecimento (ninguém fica preso para sempre) e FIFO", () => {
    const items = [
      { id: "old-low", score: 40, enqueuedAt: hoursAgo(24 * 5), position: 1 },
      { id: "new-high", score: 80, enqueuedAt: hoursAgo(1), position: 2 },
      { id: "new-mid", score: 60, enqueuedAt: hoursAgo(1), position: 3 },
    ];
    expect(orderByPriority(items, "SCORE", NOW)).toEqual(["old-low", "new-high", "new-mid"]);
    expect(orderByPriority(items, "SCORE", NOW, 0)).toEqual(["new-high", "new-mid", "old-low"]);
    expect(orderByPriority(items, "FIFO", NOW)).toEqual(["old-low", "new-high", "new-mid"]);
  });

  it("normaliza URLs para dedupe", () => {
    expect(normalizeCandidateUrl("https://WWW.Site.com/v/1/?utm_source=x&b=2&a=1#t")).toBe("https://site.com/v/1?a=1&b=2");
  });
});

describe("feeds RSS/Atom", () => {
  it("lê o feed oficial de canal do YouTube com estatísticas", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <title>Canal</title>
 <entry>
  <id>yt:video:AbCdEfGhIjK</id><yt:videoId>AbCdEfGhIjK</yt:videoId>
  <title>GTA 6: detalhe no trailer</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=AbCdEfGhIjK"/>
  <author><name>Meu Canal</name></author>
  <published>2026-11-15T10:00:00+00:00</published>
  <media:group><media:title>GTA 6</media:title><media:content url="https://www.youtube.com/v/AbCdEfGhIjK?version=3" type="application/x-shockwave-flash"/>
   <media:thumbnail url="https://i4.ytimg.com/vi/AbCdEfGhIjK/hqdefault.jpg"/><media:description>desc</media:description>
   <media:community><media:starRating count="321" average="5.00"/><media:statistics views="12345"/></media:community></media:group>
 </entry>
</feed>`;
    const feed = parseFeed(xml);
    expect(feed.entries).toHaveLength(1);
    expect(feed.entries[0]).toMatchObject({ youtubeVideoId: "AbCdEfGhIjK", views: 12345, likes: 321, author: "Meu Canal", mediaUrl: null });
  });

  it("lê RSS 2.0 com enclosure de vídeo; recusa DOCTYPE (XXE)", () => {
    const xml = `<rss version="2.0"><channel><title>Acervo</title><item><title>Clip 1</title><link>https://acervo.example.com/1</link><guid>clip-1</guid>
      <pubDate>Mon, 16 Nov 2026 10:00:00 GMT</pubDate><enclosure url="https://cdn.example.com/1.mp4" type="video/mp4" length="1000"/></item></channel></rss>`;
    const feed = parseFeed(xml);
    expect(feed.entries[0]).toMatchObject({ id: "clip-1", mediaUrl: "https://cdn.example.com/1.mp4", views: null });
    expect(() => parseFeed(`<!DOCTYPE x [<!ENTITY a "b">]><rss><channel></channel></rss>`)).toThrow(FeedParseError);
    expect(() => parseFeed("<html></html>")).toThrow(/não é um feed/);
  });
});

describe("configuração do radar", () => {
  it("padrão GTA 6 Brasil (spec §28) e validações", () => {
    const settings = defaultSettings();
    expect(settings).toMatchObject({ name: "Radar GTA 6 Brasil", frequencyMinutes: 360, queueMin: 5, queueTarget: 15, autoMode: true, supervisedMode: true });
    expect(settings.criteria.minViews).toBe(100_000);
    expect(settings.keywords).toEqual(GTA6_KEYWORDS);
    expect(() => normalizeSettings({ category: "games", theme: "gta-6", queueMin: 20, queueTarget: 10 })).toThrow(RadarConfigError);
    expect(() => normalizeSettings({ category: "games", theme: "xxx" })).toThrow(/Tema inválido/);
    expect(() => normalizeSettings({ category: "games", theme: "gta-6", frequencyMinutes: 10 })).toThrow(/Frequência/);
    expect(normalizeSettings({ category: "games", theme: "gta-6", frequencyMinutes: 90, hashtags: "GTA6, #ViceCity" }).hashtags).toEqual(["#GTA6", "#ViceCity"]);
  });

  it("fontes: pesquisa nunca é 'própria'; licença exige declaração; SSRF bloqueado na entrada", () => {
    expect(() => normalizeSource({ type: "YOUTUBE_SEARCH", license: "OWN", rightsConfirmed: true })).toThrow(/terceiros/);
    expect(() => normalizeSource({ type: "RSS", config: { url: "https://acervo.example.com/feed" }, license: "LICENSED", licenseScope: { edit: true, republish: true, commercial: true }, rightsConfirmed: true })).toThrow(/descreva a licença/);
    expect(() => normalizeSource({ type: "RSS", config: { url: "https://acervo.example.com/feed" }, license: "OWN" })).toThrow(/Confirme/);
    expect(() => normalizeSource({ type: "RSS", config: { url: "http://127.0.0.1/feed" } })).toThrow(/interno/);
    expect(() => normalizeSource({ type: "RSS", config: { url: "http://intranet.local/feed" } })).toThrow(/interno/);
    expect(() => normalizeSource({ type: "RSS", config: { url: "https://user:pw@x.com/feed" } })).toThrow(/não permitido/);
    expect(() => normalizeSource({ type: "YOUTUBE_CHANNEL", config: { channelId: "abc" } })).toThrow(/canal/);
    const ok = normalizeSource({ type: "YOUTUBE_CHANNEL", config: { channelId: "UC1234567890123456789012" }, license: "OWN", licenseScope: { edit: true, republish: true, commercial: true }, rightsConfirmed: true });
    expect(ok.license).toBe("OWN");
  });
});

describe("IA: saneamento (a IA não é a última palavra)", () => {
  it("classificação nunca 'confirma' e limita números", () => {
    const result = sanitizeClassification({ topic: "x", relevance: 7, contentType: "inventado", claimStatus: "confirmado", adaptability: -1 });
    expect(result).toMatchObject({ relevance: 1, contentType: "outro", claimStatus: "a_verificar", adaptability: 0 });
  });

  it("legenda: remove 'trailer oficial'/'vazamento' sem fonte e respeita limites", () => {
    expect(softenClaims("Gameplay oficial vazado! Data confirmada", false)).not.toMatch(/oficial|vazad|confirmad/i);
    const caption = sanitizeCaption({ instagramCaption: "Novo trailer oficial de GTA 6", hashtags: ["#GTA6", "bad tag", "#ViceCity"], cta: "Comenta aí" }, false)!;
    expect(caption.instagramCaption).not.toMatch(/oficial/i);
    expect(caption.hashtags).toEqual(["#GTA6", "#ViceCity"]);
    expect(sanitizeCaption({}, false)).toBeNull();
  });

  it("roteiro: 'confirmado' só com link de fonte oficial configurada", () => {
    const headlines = [{ title: "Rockstar anuncia", link: "https://oficial.example.com/a", publishedAt: null, source: "Oficial" }];
    const brief = sanitizeBrief(
      {
        topic: "t",
        script: ["a"],
        claims: [
          { text: "Data X", status: "confirmado", sourceLink: "https://blog-qualquer.com" },
          { text: "Anúncio", status: "confirmado", sourceLink: "https://oficial.example.com/a" },
        ],
      },
      headlines,
      "https://youtube.com/watch?v=x",
    );
    expect(brief.claims[0].status).toBe("a_verificar");
    expect(brief.claims[1].status).toBe("confirmado");
    const none = sanitizeBrief({ claims: [] }, [], "u");
    expect(none.warnings.join(" ")).toMatch(/Nenhuma informação foi confirmada/);
  });
});

describe("processamento 9:16", () => {
  it("planeja só quando precisa e preserva o enquadramento (fundo desfocado, sem distorção)", () => {
    expect(planReframe({ width: 1080, height: 1920, durationSeconds: 30 }, { mode: "FIT_9_16", maxDurationSeconds: 90 })).toBeNull();
    expect(planReframe({ width: 1920, height: 1080, durationSeconds: 30 }, { mode: "NONE", maxDurationSeconds: null })).toBeNull();
    const plan = planReframe({ width: 1920, height: 1080, durationSeconds: 120 }, { mode: "FIT_9_16", maxDurationSeconds: 90 })!;
    expect(plan).toMatchObject({ reframe: true, trimToSeconds: 90 });
    const args = buildReframeArgs("in", "out.mp4", plan).join(" ");
    expect(args).toMatch(/force_original_aspect_ratio=decrease/);
    expect(args).toMatch(/boxblur/);
    expect(args).toMatch(/-t 90/);
    expect(args).toMatch(/\+faststart/);
  });
});

describe("etapas e desempenho", () => {
  it("etapa vem do radar antes da fila e da fila/agendador depois", () => {
    expect(pipelineStage({ status: "AWAITING_AUTHORIZATION", itemStatus: null, postStatus: null, queueStatus: null })).toBe("AWAITING_AUTHORIZATION");
    expect(pipelineStage({ status: "QUEUED", itemStatus: "IMPORTING", postStatus: null, queueStatus: "ACTIVE" })).toBe("IMPORTING");
    expect(pipelineStage({ status: "QUEUED", itemStatus: "SCHEDULED", postStatus: "PROCESSING", queueStatus: "ACTIVE" })).toBe("PUBLISHING");
    expect(pipelineStage({ status: "QUEUED", itemStatus: "SCHEDULED", postStatus: "SCHEDULED", queueStatus: "PAUSED" })).toBe("PAUSED");
    expect(pipelineStage({ status: "QUEUED", itemStatus: "ERROR", postStatus: null, queueStatus: "ACTIVE" })).toBe("FAILED");
  });

  it("recomenda só com amostra suficiente e ignora métricas ausentes", () => {
    const sample = (hour: number, likes: number | null, style: string) => ({
      platform: "instagram",
      publishedAt: new Date(Date.UTC(2026, 10, 10, hour + 3)),
      captionStyle: style,
      contentType: "noticia",
      views: null,
      likes,
      comments: 1,
    });
    const few = buildPerformanceReport([sample(9, 10, "NEWS")]);
    expect(few.recommendations[0]).toMatch(/poucas publicações/);
    const report = buildPerformanceReport([
      sample(9, 100, "NEWS"),
      sample(9, 120, "NEWS"),
      sample(9, 110, "NEWS"),
      sample(20, 10, "HUMOR"),
      sample(20, 12, "HUMOR"),
      sample(20, null, "HUMOR"),
      sample(20, 8, "HUMOR"),
    ]);
    expect(report.byHour[0]).toMatchObject({ key: "09h", samples: 3 });
    expect(report.byHour[1].avgLikes).toBe(10);
    expect(report.byPlatform[0].avgViews).toBeNull();
    expect(report.recommendations.join(" ")).toMatch(/09h/);
  });
});

describe("migração pendente", () => {
  it("reconhece tabela/coluna inexistente do Postgres", async () => {
    const { isMissingSchemaError } = await import("@/lib/db/schema-errors");
    expect(isMissingSchemaError({ code: "42P01" })).toBe(true);
    expect(isMissingSchemaError(new Error('relation "viral_radars" does not exist'))).toBe(true);
    expect(isMissingSchemaError(new Error('column "block_duplicate_files" does not exist'))).toBe(true);
    expect(isMissingSchemaError(new Error("timeout"))).toBe(false);
  });
});
