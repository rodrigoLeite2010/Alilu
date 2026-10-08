// Isenção de créditos para ADMIN em Imagem → Vídeo (e regras do usuário comum intactas).
// Base copiada de ai-video-generation.test.ts: Carteira de créditos + máquina de estados da geração "imagem → vídeo",
// contra um Postgres REAL em memória (PGlite). O provedor (Runway), o
// download do MP4 (fetch) e o Vercel Blob são falsos.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";
import { makeSolidMp4 } from "../helpers/ai-video-media";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({
  getDb: () => db.sql,
  assertDatabaseConfigured: () => undefined,
}));
const blobPut = vi.fn();
const blobDel = vi.fn();
vi.mock("@vercel/blob", () => ({ put: (...args: unknown[]) => blobPut(...args), del: (...args: unknown[]) => blobDel(...args) }));

const wallet = await import("@/lib/ai-video/backend/wallet-repository");
const service = await import("@/lib/ai-video/backend/generation-service");
const registry = await import("@/lib/ai-video/backend/providers/provider-registry");
const { ImageToVideoProviderError } = await import("@/lib/ai-video/backend/providers/provider");
import type { ImageToVideoProvider, VideoGenerationStatus } from "@/lib/ai-video/backend/providers/provider";

const T0 = new Date("2026-10-01T12:00:00.000Z");
// MP4 de verdade: a finalização valida o arquivo com ffprobe antes de consumir os créditos.
const SAMPLE_MP4 = makeSolidMp4();
const at = (ms: number) => new Date(T0.getTime() + ms);

const provider = {
  providerId: "runway",
  supports: vi.fn(() => true),
  create: vi.fn(),
  getStatus: vi.fn(),
  cancel: vi.fn(async () => undefined),
};
const originalFetch = global.fetch;
const fetchMock = vi.fn();

function status(overrides: Partial<VideoGenerationStatus>): VideoGenerationStatus {
  return { state: "PROCESSING", outputUrls: [], failureCode: null, failureMessage: null, failureKind: null, ...overrides };
}

async function seedUser(credits: number, suffix = "1") {
  const [user] = await db.sql`insert into users (email) values (${`${suffix === "admin" ? "admin-video" : "video" + suffix}@example.com`}) returning id`;
  const userId = user.id as string;
  if (credits > 0) {
    await wallet.applyWalletMovement({
      userId,
      type: "ADMIN_ADJUSTMENT",
      availableDelta: credits,
      reservedDelta: 0,
      referenceType: "test_seed",
      referenceId: userId,
      description: "seed",
    });
  }
  return userId;
}

function input(userId: string, overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: "chave-idem-0001",
    imageUrl: `https://abc123.public.blob.vercel-storage.com/ai-video/${userId}/input/foto.jpg`,
    prompt: "câmera aproxima devagar",
    tier: "PADRAO",
    durationSeconds: 5,
    aspectRatio: "9:16",
    ...overrides,
  };
}

async function balance(userId: string) {
  const w = await wallet.getWallet(userId);
  return { available: w?.available ?? 0, reserved: w?.reserved ?? 0 };
}

async function ledgerTypes(userId: string) {
  const rows = await db.sql`select type from ai_credit_transactions where user_id = ${userId} order by created_at, id`;
  return rows.map((row) => row.type);
}

beforeEach(async () => {
  process.env.ADMIN_EMAILS = "admin-video@example.com";
  db = await createTestDb();
  // Estes testes criam várias gerações em sequência; o limite "um vídeo por vez" tem teste próprio.
  await db.sql`update ai_pricing_config set max_concurrent_generations_per_user = 10`;
  // Estes testes são da mecânica de reserva/consumo/devolução, não do preço: fixam o vídeo de 5 s em 100 créditos
  // (os preços reais em R$ 0,05/crédito têm teste próprio em ai-video-tiers-retry-issues e plans-usage).
  await db.sql`update ai_video_model_pricing set alilu_credit_cost = 100 where provider_model = 'gen4_turbo' and duration_seconds = 5`;
  registry.__setImageToVideoProvidersForTests({
    runway: provider as unknown as ImageToVideoProvider,
    fal: provider as unknown as ImageToVideoProvider,
  });
  provider.supports.mockReset().mockReturnValue(true);
  provider.create.mockReset().mockResolvedValue({ externalTaskId: "task-1" });
  provider.getStatus.mockReset();
  provider.cancel.mockReset().mockResolvedValue(undefined);
  blobPut.mockReset().mockResolvedValue({ url: "https://abc123.public.blob.vercel-storage.com/ai-video/u/generated/v.mp4" });
  blobDel.mockReset().mockResolvedValue(undefined);
  fetchMock.mockReset().mockImplementation(async () => new Response(new Uint8Array(SAMPLE_MP4), { status: 200 }));
  global.fetch = fetchMock as unknown as typeof fetch;
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  registry.__setImageToVideoProvidersForTests(null);
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  await db.close();
});

describe("isenção de créditos do admin — Imagem → Vídeo", () => {
  async function runToCompletion(userId: string, generationId: string) {
    provider.getStatus.mockResolvedValueOnce(status({ state: "SUCCEEDED", outputUrls: ["https://dnznrvs05pmza.cloudfront.net/out.mp4"] }));
    return service.refreshGenerationForUser(generationId, userId, at(30_000));
  }

  it("1) usuário comum com saldo: gera e debita", async () => {
    const userId = await seedUser(150);
    const generation = await service.createGeneration(userId, input(userId), T0);
    expect(generation.creditBypass).toBe(false);
    expect((await runToCompletion(userId, generation.id))?.status).toBe("COMPLETED");
    expect(await balance(userId)).toEqual({ available: 50, reserved: 0 });
    expect(await ledgerTypes(userId)).toEqual(["ADMIN_ADJUSTMENT", "RESERVE", "CONSUME"]);
    const done = await service.refreshGenerationForUser(generation.id, userId, at(31_000));
    expect(done?.creditsCharged).toBe(100);
  });

  it("2) usuário comum sem saldo: bloqueado, nada enviado ao provedor", async () => {
    const userId = await seedUser(10, "2");
    await expect(service.createGeneration(userId, input(userId), T0)).rejects.toMatchObject({ code: "INSUFFICIENT_CREDITS" });
    expect(provider.create).not.toHaveBeenCalled();
    expect(await balance(userId)).toEqual({ available: 10, reserved: 0 });
  });

  it("3) admin com saldo 0: gera normalmente, sem débito e com registro da isenção", async () => {
    const adminId = await seedUser(0, "admin");
    const generation = await service.createGeneration(adminId, input(adminId), T0);
    expect(generation.status).toBe("SUBMITTED");
    expect(generation.creditBypass).toBe(true);
    expect(generation.bypassReason).toBe("Admin");
    expect(generation.creditCost).toBe(100); // equivalente em créditos
    expect(generation.creditsCharged).toBe(0);
    expect(generation.providerEstimatedCostUsd).toBeGreaterThan(0); // custo real do provedor segue registrado
    expect(provider.create).toHaveBeenCalledTimes(1);
    const done = await runToCompletion(adminId, generation.id);
    expect(done?.status).toBe("COMPLETED");
    expect(done?.creditsCharged).toBe(0);
    expect(await balance(adminId)).toEqual({ available: 0, reserved: 0 });
    expect(await ledgerTypes(adminId)).toEqual([]);
  });

  it("4) falha do admin: sem débito, sem devolução fictícia, erro registrado", async () => {
    const adminId = await seedUser(0, "admin");
    provider.create.mockRejectedValueOnce(new ImageToVideoProviderError("imagem inválida", "USER_ERROR", false, 400, "INPUT"));
    const generation = await service.createGeneration(adminId, input(adminId), T0);
    expect(generation.status).toBe("FAILED");
    expect(generation.errorCode).toBe("INPUT");
    expect(generation.creditsCharged).toBe(0);
    expect(await balance(adminId)).toEqual({ available: 0, reserved: 0 });
    expect(await ledgerTypes(adminId)).toEqual([]);
  });

  it("5) admin gera várias vezes: saldo real inalterado (isenção não é saldo infinito)", async () => {
    const adminId = await seedUser(70, "admin");
    for (let i = 0; i < 3; i += 1) {
      const generation = await service.createGeneration(adminId, input(adminId, { idempotencyKey: `chave-admin-000${i}` }), T0);
      provider.create.mockResolvedValue({ externalTaskId: `task-${i}` });
      await runToCompletion(adminId, generation.id);
    }
    expect(await balance(adminId)).toEqual({ available: 70, reserved: 0 });
    expect(await ledgerTypes(adminId)).toEqual(["ADMIN_ADJUSTMENT"]);
    const rows = await db.sql`select count(*)::int as n from ai_video_generations where user_id = ${adminId} and credit_bypass`;
    expect(rows[0].n).toBe(3);
  });

  it("6) a isenção do admin não vaza para usuário comum (e depois da mudança a regra antiga segue)", async () => {
    const adminId = await seedUser(0, "admin");
    const userId = await seedUser(0, "6");
    await service.createGeneration(adminId, input(adminId), T0);
    await expect(service.createGeneration(userId, input(userId, { idempotencyKey: "chave-comum-0001" }), T0)).rejects.toMatchObject({ code: "INSUFFICIENT_CREDITS" });
    const rows = await db.sql`select count(*)::int as n from ai_video_generations where user_id = ${userId}`;
    expect(rows[0].n).toBe(0);
  });

  it("usuário comum que falha continua sendo reembolsado", async () => {
    const userId = await seedUser(150, "7");
    provider.create.mockRejectedValueOnce(new ImageToVideoProviderError("imagem inválida", "USER_ERROR", false, 400, "INPUT"));
    const generation = await service.createGeneration(userId, input(userId), T0);
    expect(generation.status).toBe("REFUNDED");
    expect(await balance(userId)).toEqual({ available: 150, reserved: 0 });
  });
});
