// Evolução do vídeo com IA: faixas Econômico/Padrão/Premium, textos/logos
// aplicados depois da IA, devolução por resultado inválido, "gerar
// novamente com desconto", "reportar problema" e vários jobs simultâneos.
// Postgres real em memória (PGlite); provedor, downloads e Blob são falsos;
// o FFmpeg/ffprobe são os de verdade (ffmpeg-static).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";
import { makeLogoPng, makeSolidMp4 } from "../helpers/ai-video-media";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));
const blobPut = vi.fn();
vi.mock("@vercel/blob", () => ({ put: (...args: unknown[]) => blobPut(...args), del: vi.fn() }));

const wallet = await import("@/lib/ai-video/backend/wallet-repository");
const service = await import("@/lib/ai-video/backend/generation-service");
const issues = await import("@/lib/ai-video/backend/generation-issue-service");
const registry = await import("@/lib/ai-video/backend/providers/provider-registry");
const { buildSimpleOverlays } = await import("@/lib/ai-video/overlays");
import type { ImageToVideoProvider, VideoGenerationStatus } from "@/lib/ai-video/backend/providers/provider";

const T0 = new Date("2026-10-01T12:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);
const SAMPLE_MP4 = makeSolidMp4();
const LOGO = makeLogoPng();
const STORED_URL = "https://abc123.public.blob.vercel-storage.com/ai-video/u/generated/final.mp4";

function makeProvider(id: string) {
  return {
    providerId: id,
    supports: vi.fn(() => true),
    create: vi.fn(async () => ({ externalTaskId: `${id}-task` })),
    getStatus: vi.fn(async (): Promise<VideoGenerationStatus> => ({ state: "SUCCEEDED", outputUrls: ["https://cdn.example.com/out.mp4"], failureCode: null, failureMessage: null, failureKind: null })),
    cancel: vi.fn(async () => undefined),
  };
}
let runway = makeProvider("runway");
let fal = makeProvider("fal");

let storedVideo: Buffer = SAMPLE_MP4;
const originalFetch = global.fetch;
async function defaultFetch(url: string | URL): Promise<Response> {
  const href = String(url);
  if (href.includes("/logo")) return new Response(new Uint8Array(LOGO), { status: 200 });
  if (href === STORED_URL) return new Response(new Uint8Array(storedVideo), { status: 200 });
  return new Response(new Uint8Array(SAMPLE_MP4), { status: 200 });
}
const fetchMock = vi.fn(defaultFetch);

async function seedUser(credits: number, suffix = "1") {
  const [user] = await db.sql`insert into users (email) values (${`tiers${suffix}@example.com`}) returning id`;
  const userId = user.id as string;
  if (credits > 0) {
    await wallet.applyWalletMovement({ userId, type: "ADMIN_ADJUSTMENT", availableDelta: credits, reservedDelta: 0, referenceType: "test_seed", referenceId: userId, description: "seed" });
  }
  return userId;
}

const imageOf = (userId: string) => `https://abc123.public.blob.vercel-storage.com/ai-video/${userId}/input/foto.jpg`;

function input(userId: string, overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: `chave-${Math.random().toString(36).slice(2, 12)}`,
    imageUrl: imageOf(userId),
    prompt: "câmera aproxima devagar",
    tier: "ECONOMICO",
    durationSeconds: 5,
    aspectRatio: "9:16",
    ...overrides,
  };
}

async function available(userId: string) {
  return (await wallet.getWallet(userId))?.available ?? 0;
}

/** Cria e já leva até o fim (o provedor falso responde "pronto" na primeira consulta). */
async function generateCompleted(userId: string, overrides: Record<string, unknown> = {}) {
  const generation = await service.createGeneration(userId, input(userId, overrides), T0);
  return (await service.refreshGenerationForUser(generation.id, userId, at(20_000)))!;
}

beforeEach(async () => {
  db = await createTestDb();
  runway = makeProvider("runway");
  fal = makeProvider("fal");
  registry.__setImageToVideoProvidersForTests({ runway: runway as unknown as ImageToVideoProvider, fal: fal as unknown as ImageToVideoProvider });
  blobPut.mockReset().mockResolvedValue({ url: STORED_URL });
  storedVideo = SAMPLE_MP4;
  fetchMock.mockReset().mockImplementation(defaultFetch);
  global.fetch = fetchMock as unknown as typeof fetch;
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  registry.__setImageToVideoProvidersForTests(null);
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  await db.close();
});

describe("faixas", () => {
  it("Econômico → fal (Wan 2.2, 65 créditos); Padrão → gen4_turbo (100); Premium → gen4.5 (230); o usuário nunca vê o provedor", async () => {
    const options = await service.listGenerationOptions();
    const find = (tier: string, seconds: number) => options.find((o) => o.tier === tier && o.durationSeconds === seconds);
    expect(find("ECONOMICO", 5)?.credits).toBe(65);
    expect(find("PADRAO", 5)?.credits).toBe(100);
    expect(find("PADRAO", 10)?.credits).toBe(195);
    expect(find("PREMIUM", 5)?.credits).toBe(230);
    expect(JSON.stringify(options)).not.toMatch(/runway|fal|gen4|wan/i);

    const userId = await seedUser(1000);
    const econ = await service.createGeneration(userId, input(userId), T0);
    expect(econ).toMatchObject({ provider: "fal", providerModel: "fal-ai/wan/v2.2-5b/image-to-video", creditCost: 65 });
    expect(fal.create).toHaveBeenCalledTimes(1);
    const premium = await service.createGeneration(userId, input(userId, { tier: "PREMIUM" }), T0);
    expect(premium).toMatchObject({ provider: "runway", providerModel: "gen4.5", creditCost: 230 });
    expect(await available(userId)).toBe(1000 - 65 - 230);
  });

  it("todas as faixas iniciais ficam na margem alvo (≥ 50%)", async () => {
    const view = await (await import("@/lib/ai-video/backend/admin-service")).getPricingAdminView();
    for (const model of view.models) expect(model.grossMarginPct).toBeGreaterThanOrEqual(49.9);
  });
});

describe("preservar textos e logo", () => {
  it("aplica logo + URL depois da IA, valida o MP4 final e só então consome", async () => {
    const userId = await seedUser(100);
    const overlays = buildSimpleOverlays({
      logoUrl: `https://abc123.public.blob.vercel-storage.com/ai-video/${userId}/input/logo-marca.png`,
      url: "www.alilu.com.br",
      mainText: "Promoção de inverno",
    });
    const done = await generateCompleted(userId, { preserveText: true, overlays });
    expect(done.status).toBe("COMPLETED");
    expect(done.overlays).toHaveLength(3);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("logo-marca.png"))).toBe(true);
    const uploaded = blobPut.mock.calls[0][1] as Buffer;
    expect(uploaded.equals(SAMPLE_MP4)).toBe(false); // o vídeo final é o pós-processado
    expect(uploaded.length).toBeGreaterThan(1000);
    // O provedor recebeu o prompt com a instrução de não mexer em texto — mas o texto nunca foi enviado a ele.
    const sent = (fal.create.mock.calls as unknown as Array<[{ prompt: string }]>)[0][0];
    expect(sent.prompt).toContain("câmera aproxima devagar");
    expect(sent.prompt).not.toContain("www.alilu.com.br");
    expect(await available(userId)).toBe(35);
  }, 60_000);

  it("sem a opção, os overlays enviados são ignorados (só anima a imagem)", async () => {
    const userId = await seedUser(100);
    const done = await generateCompleted(userId, { preserveText: false, overlays: buildSimpleOverlays({ url: "www.alilu.com.br" }) });
    expect(done.status).toBe("COMPLETED");
    expect(done.overlays).toEqual([]);
    expect((blobPut.mock.calls[0][1] as Buffer).equals(SAMPLE_MP4)).toBe(true);
  });

  it("logo de outro usuário/URL externa é recusado antes de reservar", async () => {
    const userId = await seedUser(100);
    const overlays = buildSimpleOverlays({ logoUrl: "https://abc123.public.blob.vercel-storage.com/ai-video/outro/input/logo.png" });
    const error = await service.createGeneration(userId, input(userId, { preserveText: true, overlays }), T0).catch((e) => e);
    expect(error.code).toBe("INVALID_OVERLAYS");
    expect(fal.create).not.toHaveBeenCalled();
    expect(await available(userId)).toBe(100);
  });

  it("falha do pós-processamento: tenta de novo e, esgotadas as tentativas, devolve os créditos", async () => {
    const userId = await seedUser(100);
    fetchMock.mockImplementation(async (url: string | URL) =>
      String(url).includes("/logo") ? new Response("não é imagem", { status: 200 }) : new Response(new Uint8Array(SAMPLE_MP4), { status: 200 }),
    );
    const overlays = buildSimpleOverlays({ logoUrl: `https://abc123.public.blob.vercel-storage.com/ai-video/${userId}/input/logo.png` });
    const first = await generateCompleted(userId, { preserveText: true, overlays });
    expect(["AI_COMPLETED", "POST_PROCESSING"]).toContain(first.status);
    await service.refreshGenerationForUser(first.id, userId, at(60_000));
    const last = await service.refreshGenerationForUser(first.id, userId, at(100_000));
    expect(last?.status).toBe("REFUNDED");
    expect(last?.providerCharged).toBe(true);
    expect(await available(userId)).toBe(100);
    expect(blobPut).not.toHaveBeenCalled();
  }, 60_000);
});

describe("resultado inválido → devolução automática", () => {
  it("MP4 vazio do provedor devolve sem depender do usuário", async () => {
    const userId = await seedUser(100);
    fetchMock.mockImplementation(async () => new Response(new Uint8Array(0), { status: 200 }));
    const done = await generateCompleted(userId);
    expect(done.status).toBe("REFUNDED");
    expect(done.errorCode).toBe("INVALID_OUTPUT_EMPTY_FILE");
    expect(done.providerCharged).toBe(true);
    expect(await available(userId)).toBe(100);
  });
});

describe("gerar novamente com desconto", () => {
  it("50% do preço cheio, mesma imagem, sem cobrar duas vezes no clique duplo", async () => {
    const userId = await seedUser(500);
    const parent = await generateCompleted(userId, { tier: "PADRAO" });
    expect(parent.creditCost).toBe(100);
    const options = await service.listGenerationOptions();
    expect(options.find((o) => o.tier === "PADRAO" && o.durationSeconds === 5)?.retryCredits).toBe(50);

    const retryInput = input(userId, { tier: "PADRAO", retryOfGenerationId: parent.id, prompt: "agora girando devagar" });
    const [a, b] = await Promise.all([service.createGeneration(userId, retryInput, T0), service.createGeneration(userId, retryInput, T0)]);
    expect(a.id).toBe(b.id);
    expect(a).toMatchObject({ creditCost: 50, pricingKind: "RETRY_DISCOUNT", listCreditCost: 100, parentGenerationId: parent.id });
    expect(await available(userId)).toBe(500 - 100 - 50);
  });

  it("o desconto nunca deixa a regeneração abaixo do custo", async () => {
    const userId = await seedUser(500);
    await db.sql`update ai_pricing_config set retry_discount_pct = 90`;
    const parent = await generateCompleted(userId, { tier: "PADRAO" });
    const retry = await service.createGeneration(userId, input(userId, { tier: "PADRAO", retryOfGenerationId: parent.id }), T0);
    // gen4_turbo 5 s: custo total R$ 1,80 → precisa de ≥ R$ 1,90 de receita (taxa 5%) → 50 créditos, não 10.
    expect(retry.creditCost).toBe(50);
    expect(retry.revenueAllocatedBrl * 0.95).toBeGreaterThanOrEqual(retry.estimatedCostBrl);
  });

  it("só a partir de vídeo concluído, com a mesma imagem e até o limite", async () => {
    const userId = await seedUser(2000);
    const parent = await generateCompleted(userId);
    await expect(
      service.createGeneration(userId, input(userId, { retryOfGenerationId: parent.id, imageUrl: `https://abc123.public.blob.vercel-storage.com/ai-video/${userId}/input/outra.jpg` }), T0),
    ).rejects.toMatchObject({ code: "RETRY_IMAGE_CHANGED" });
    for (let i = 0; i < 3; i += 1) await service.createGeneration(userId, input(userId, { retryOfGenerationId: parent.id }), T0);
    await expect(service.createGeneration(userId, input(userId, { retryOfGenerationId: parent.id }), T0)).rejects.toMatchObject({ code: "RETRY_LIMIT" });
    const other = await seedUser(500, "2");
    await expect(service.createGeneration(other, input(other, { retryOfGenerationId: parent.id }), T0)).rejects.toMatchObject({ code: "RETRY_NOT_ALLOWED" });
  });

  it("a trava de custo continua valendo na regeneração", async () => {
    const userId = await seedUser(500);
    const parent = await generateCompleted(userId, { tier: "PADRAO" });
    await db.sql`update ai_pricing_config set max_provider_cost_usd = 0.10`;
    await expect(service.createGeneration(userId, input(userId, { tier: "PADRAO", retryOfGenerationId: parent.id }), T0)).rejects.toMatchObject({ code: "PRICE_GUARD_BLOCKED" });
  });
});

describe("reportar problema", () => {
  it("vídeo corrompido confirmado → devolve os créditos já consumidos (uma vez só)", async () => {
    const userId = await seedUser(100);
    const done = await generateCompleted(userId);
    expect(await available(userId)).toBe(35);
    storedVideo = Buffer.alloc(0);
    const result = await issues.reportGenerationIssue(userId, done.id, { issueType: "VIDEO_CORRUPTED" }, at(60_000));
    expect(result).toMatchObject({ resolution: "REFUNDED", refundedCredits: 65 });
    expect(result.generation.status).toBe("REFUNDED");
    expect(await available(userId)).toBe(100);
    await expect(issues.reportGenerationIssue(userId, done.id, { issueType: "VIDEO_CORRUPTED" }, at(60_000))).rejects.toMatchObject({ code: "ISSUE_NOT_ALLOWED" });
    expect(await available(userId)).toBe(100);
  });

  it("vídeo válido reportado como corrompido não devolve; 'não gostei' oferece regeneração com desconto", async () => {
    const userId = await seedUser(200);
    const a = await generateCompleted(userId);
    expect((await issues.reportGenerationIssue(userId, a.id, { issueType: "VIDEO_CORRUPTED" }, at(60_000))).resolution).toBe("RETRY_OFFERED");
    const b = await generateCompleted(userId);
    const result = await issues.reportGenerationIssue(userId, b.id, { issueType: "WRONG_MOTION", description: "girou para o lado errado" }, at(60_000));
    expect(result.resolution).toBe("RETRY_OFFERED");
    expect(await available(userId)).toBe(200 - 65 - 65);
    const [row] = await db.sql`select issue_type, description from ai_video_generation_issues where generation_id = ${b.id}`;
    expect(row).toEqual({ issue_type: "WRONG_MOTION", description: "girou para o lado errado" });
    await expect(issues.reportGenerationIssue(userId, b.id, { issueType: "OTHER" }, at(60_000))).rejects.toMatchObject({ httpStatus: 409 });
  });

  it("muitos reportes marcam para revisão (sem bloquear)", async () => {
    const userId = await seedUser(1000);
    await db.sql`update ai_pricing_config set issue_review_threshold = 2`;
    const a = await generateCompleted(userId);
    const b = await generateCompleted(userId);
    expect((await issues.reportGenerationIssue(userId, a.id, { issueType: "OTHER" }, at(60_000))).flaggedForReview).toBe(false);
    expect((await issues.reportGenerationIssue(userId, b.id, { issueType: "OTHER" }, at(60_000))).flaggedForReview).toBe(true);
    // continua podendo gerar
    expect((await service.createGeneration(userId, input(userId), T0)).status).not.toBe("PRICE_GUARD_BLOCKED");
    const dashboard = await (await import("@/lib/ai-video/backend/admin-service")).getCostsDashboard(at(60_000));
    expect(dashboard.usersForReview).toEqual([{ email: "tiers1@example.com", reports: 2, refunds: 0 }]);
  });

  it("não aceita reporte de vídeo de outro usuário nem tipo inválido", async () => {
    const owner = await seedUser(100);
    const other = await seedUser(0, "2");
    const done = await generateCompleted(owner);
    await expect(issues.reportGenerationIssue(other, done.id, { issueType: "OTHER" })).rejects.toMatchObject({ code: "ISSUE_NOT_ALLOWED" });
    await expect(issues.reportGenerationIssue(owner, done.id, { issueType: "QUALQUER" })).rejects.toMatchObject({ code: "INVALID_ISSUE_TYPE" });
  });
});

describe("vários jobs simultâneos", () => {
  it("dois crons ao mesmo tempo: cada geração é finalizada e consumida uma única vez", async () => {
    const userId = await seedUser(1000);
    fal.getStatus.mockResolvedValue({ state: "PROCESSING", outputUrls: [], failureCode: null, failureMessage: null, failureKind: null });
    const created = [];
    for (let i = 0; i < 3; i += 1) created.push(await service.createGeneration(userId, input(userId), T0));
    expect(await available(userId)).toBe(1000 - 3 * 65);

    fal.getStatus.mockResolvedValue({ state: "SUCCEEDED", outputUrls: ["https://cdn.example.com/out.mp4"], failureCode: null, failureMessage: null, failureKind: null });
    const [first, second] = await Promise.all([service.runAiVideoCron({ now: () => at(30_000) }), service.runAiVideoCron({ now: () => at(30_000) })]);
    expect(first.processed + second.processed).toBe(3);
    const rows = await db.sql`select status from ai_video_generations`;
    expect(rows.every((row) => row.status === "COMPLETED")).toBe(true);
    const consumes = await db.sql`select count(*)::int as total from ai_credit_transactions where type = 'CONSUME'`;
    expect(consumes[0].total).toBe(3);
    expect(blobPut).toHaveBeenCalledTimes(3);
    const w = await wallet.getWallet(userId);
    expect(w).toMatchObject({ available: 1000 - 195, reserved: 0 });
  }, 60_000);
});
