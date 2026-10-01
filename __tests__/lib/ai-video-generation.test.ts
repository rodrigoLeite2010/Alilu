// Carteira de créditos + máquina de estados da geração "imagem → vídeo",
// contra um Postgres REAL em memória (PGlite). O provedor (Runway), o
// download do MP4 (fetch) e o Vercel Blob são falsos.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

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
  const [user] = await db.sql`insert into users (email) values (${`video${suffix}@example.com`}) returning id`;
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
    tier: "ECONOMICO",
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
  db = await createTestDb();
  registry.__setImageToVideoProvidersForTests({ runway: provider as unknown as ImageToVideoProvider });
  provider.supports.mockReset().mockReturnValue(true);
  provider.create.mockReset().mockResolvedValue({ externalTaskId: "task-1" });
  provider.getStatus.mockReset();
  provider.cancel.mockReset().mockResolvedValue(undefined);
  blobPut.mockReset().mockResolvedValue({ url: "https://abc123.public.blob.vercel-storage.com/ai-video/u/generated/v.mp4" });
  blobDel.mockReset().mockResolvedValue(undefined);
  fetchMock.mockReset().mockResolvedValue(new Response(new Uint8Array([0, 0, 0, 24]), { status: 200 }));
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

describe("carteira", () => {
  it("o mesmo lançamento (tipo + referência) só é aplicado uma vez, mesmo em paralelo", async () => {
    const userId = await seedUser(0);
    const movement = {
      userId,
      type: "PURCHASE" as const,
      availableDelta: 500,
      reservedDelta: 0,
      referenceType: "ai_credit_purchase",
      referenceId: "compra-1",
      description: "Compra",
    };
    const results = await Promise.all([wallet.applyWalletMovement(movement), wallet.applyWalletMovement(movement)]);
    expect(results.map((r) => r.status).sort()).toEqual(["applied", "duplicate"]);
    expect(await balance(userId)).toEqual({ available: 500, reserved: 0 });
  });

  it("nunca deixa o saldo negativo", async () => {
    const userId = await seedUser(50);
    const result = await wallet.applyWalletMovement({
      userId,
      type: "RESERVE",
      availableDelta: -100,
      reservedDelta: 100,
      referenceType: "ai_video_generation",
      referenceId: "g-1",
      description: "Reserva",
    });
    expect(result.status).toBe("insufficient");
    expect(await balance(userId)).toEqual({ available: 50, reserved: 0 });
  });

  it("bônus de boas-vindas só uma vez por usuário", async () => {
    const userId = await seedUser(0);
    const granted = await Promise.all([wallet.grantWelcomeBonusOnce(userId, 100), wallet.grantWelcomeBonusOnce(userId, 100)]);
    expect(granted.filter(Boolean)).toHaveLength(1);
    expect(await wallet.grantWelcomeBonusOnce(userId, 100)).toBe(false);
    expect((await balance(userId)).available).toBe(100);
    const viaService = await service.getWalletWithWelcomeBonus(userId);
    expect(viaService.available).toBe(100);
  });
});

describe("geração", () => {
  it("reserva, envia, e no sucesso copia o MP4 e consome a reserva", async () => {
    const userId = await seedUser(150);
    const generation = await service.createGeneration(userId, input(userId), T0);
    expect(generation.status).toBe("SUBMITTED");
    expect(generation.creditCost).toBe(100);
    expect(generation.externalTaskId).toBe("task-1");
    expect(provider.create).toHaveBeenCalledWith(expect.objectContaining({ model: "gen4_turbo", durationSeconds: 5, aspectRatio: "9:16" }));
    expect(await balance(userId)).toEqual({ available: 50, reserved: 100 });

    provider.getStatus.mockResolvedValueOnce(status({ state: "PROCESSING" }));
    const processing = await service.refreshGenerationForUser(generation.id, userId, at(15_000));
    expect(processing?.status).toBe("PROCESSING");

    provider.getStatus.mockResolvedValueOnce(status({ state: "SUCCEEDED", outputUrls: ["https://dnznrvs05pmza.cloudfront.net/out.mp4"] }));
    const done = await service.refreshGenerationForUser(generation.id, userId, at(30_000));
    expect(done?.status).toBe("COMPLETED");
    expect(done?.storageVideoUrl).toContain("vercel-storage.com");
    expect(blobPut).toHaveBeenCalledWith(expect.stringContaining(`ai-video/${userId}/generated/${generation.id}`), expect.anything(), expect.objectContaining({ contentType: "video/mp4" }));
    expect(await balance(userId)).toEqual({ available: 50, reserved: 0 });
    expect(await ledgerTypes(userId)).toEqual(["ADMIN_ADJUSTMENT", "RESERVE", "CONSUME"]);

    // Consultar de novo não consome de novo.
    await service.refreshGenerationForUser(generation.id, userId, at(60_000));
    expect(await ledgerTypes(userId)).toEqual(["ADMIN_ADJUSTMENT", "RESERVE", "CONSUME"]);
  });

  it("clique duplo com a mesma chave não cobra nem envia duas vezes", async () => {
    const userId = await seedUser(300);
    const [first, second] = await Promise.all([
      service.createGeneration(userId, input(userId), T0),
      service.createGeneration(userId, input(userId), T0),
    ]);
    expect(second.id).toBe(first.id);
    const third = await service.createGeneration(userId, input(userId), T0);
    expect(third.id).toBe(first.id);
    expect(provider.create).toHaveBeenCalledTimes(1);
    expect(await balance(userId)).toEqual({ available: 200, reserved: 100 });
  });

  it("créditos insuficientes: 402 com quanto falta, sem chamar o provedor e sem deixar geração", async () => {
    const userId = await seedUser(40);
    const error = await service.createGeneration(userId, input(userId), T0).catch((e) => e);
    expect(error).toBeInstanceOf(service.AiVideoError);
    expect(error.httpStatus).toBe(402);
    expect(error.code).toBe("INSUFFICIENT_CREDITS");
    expect(error.details).toEqual({ required: 100, available: 40, missing: 60 });
    expect(provider.create).not.toHaveBeenCalled();
    expect(await db.sql`select id from ai_video_generations`).toHaveLength(0);
    expect(await balance(userId)).toEqual({ available: 40, reserved: 0 });
  });

  it("o preço vem do servidor: valores do front para custo são ignorados e combinações inválidas recusadas", async () => {
    const userId = await seedUser(1000);
    const generation = await service.createGeneration(userId, { ...input(userId), creditCost: 1 } as never, T0);
    expect(generation.creditCost).toBe(100);
    await expect(service.createGeneration(userId, input(userId, { idempotencyKey: "chave-idem-k2", tier: "ALTA" }), T0)).rejects.toBeInstanceOf(service.AiVideoError);
    await expect(service.createGeneration(userId, input(userId, { idempotencyKey: "chave-idem-k3", durationSeconds: 7 }), T0)).rejects.toBeInstanceOf(service.AiVideoError);
    await expect(
      service.createGeneration(userId, input(userId, { idempotencyKey: "chave-idem-k4", imageUrl: "https://evil.example.com/ai-video/x/input/a.jpg" }), T0),
    ).rejects.toBeInstanceOf(service.AiVideoError);
    await expect(
      service.createGeneration(userId, input(userId, { idempotencyKey: "chave-idem-k5", imageUrl: "https://abc123.public.blob.vercel-storage.com/ai-video/outro-usuario/input/a.jpg" }), T0),
    ).rejects.toBeInstanceOf(service.AiVideoError);
    expect(provider.create).toHaveBeenCalledTimes(1);
  });

  it("trava de preço: custo acima do máximo bloqueia sem reservar nem chamar o provedor", async () => {
    const userId = await seedUser(500);
    await db.sql`update ai_pricing_config set max_provider_cost_usd = 0.10`;
    const error = await service.createGeneration(userId, input(userId), T0).catch((e) => e);
    expect(error.code).toBe("PRICE_GUARD_BLOCKED");
    expect(error.httpStatus).toBe(503);
    expect(provider.create).not.toHaveBeenCalled();
    expect(await balance(userId)).toEqual({ available: 500, reserved: 0 });
    const [row] = await db.sql`select status, error_code from ai_video_generations`;
    expect(row).toEqual({ status: "PRICE_GUARD_BLOCKED", error_code: "PRICE_LIMIT_EXCEEDED" });
  });

  it("trava de preço: margem abaixo da mínima também bloqueia", async () => {
    const userId = await seedUser(500);
    await db.sql`update ai_video_model_pricing set alilu_credit_cost = 50 where provider_model = 'gen4_turbo' and duration_seconds = 5`;
    const error = await service.createGeneration(userId, input(userId), T0).catch((e) => e);
    expect(error.code).toBe("PRICE_GUARD_BLOCKED");
    const [row] = await db.sql`select error_code from ai_video_generations`;
    expect(row.error_code).toBe("MARGIN_BELOW_MINIMUM");
  });

  it("erro definitivo no envio devolve os créditos", async () => {
    const userId = await seedUser(100);
    provider.create.mockRejectedValueOnce(new ImageToVideoProviderError("imagem inválida", "USER_ERROR", false, 400, "INPUT"));
    const generation = await service.createGeneration(userId, input(userId), T0);
    expect(generation.status).toBe("REFUNDED");
    expect(generation.errorKind).toBe("USER_ERROR");
    expect(await balance(userId)).toEqual({ available: 100, reserved: 0 });
    expect(await ledgerTypes(userId)).toEqual(["ADMIN_ADJUSTMENT", "RESERVE", "REFUND"]);
  });

  it("erro temporário (429/5xx) no envio: o cron tenta de novo e depois envia", async () => {
    const userId = await seedUser(100);
    provider.create.mockRejectedValueOnce(new ImageToVideoProviderError("ocupado", "TECHNICAL", true, 429));
    const generation = await service.createGeneration(userId, input(userId), T0);
    expect(generation.status).toBe("CREDIT_RESERVED");
    expect(generation.attempts).toBe(1);

    expect((await service.runAiVideoCron({ now: () => at(30_000) })).processed).toBe(0); // ainda não está na hora
    expect((await service.runAiVideoCron({ now: () => at(61_000) })).processed).toBe(1);
    const [row] = await db.sql`select status, external_task_id from ai_video_generations`;
    expect(row).toEqual({ status: "SUBMITTED", external_task_id: "task-1" });
    expect(await balance(userId)).toEqual({ available: 0, reserved: 100 });
  });

  it("falha no provedor devolve os créditos; moderação repetida bloqueia temporariamente", async () => {
    const userId = await seedUser(1000);
    for (let index = 0; index < 3; index += 1) {
      provider.create.mockResolvedValueOnce({ externalTaskId: `task-m${index}` });
      const generation = await service.createGeneration(userId, input(userId, { idempotencyKey: `chave-moder-${index}` }), T0);
      provider.getStatus.mockResolvedValueOnce(status({ state: "FAILED", failureCode: "SAFETY.INPUT.IMAGE", failureKind: "MODERATION" }));
      const failed = await service.refreshGenerationForUser(generation.id, userId, at(20_000));
      expect(failed?.status).toBe("REFUNDED");
      expect(failed?.errorCode).toBe("MODERATION");
    }
    expect(await balance(userId)).toEqual({ available: 1000, reserved: 0 });
    const blocked = await service.createGeneration(userId, input(userId, { idempotencyKey: "chave-moder-final" }), T0).catch((e) => e);
    expect(blocked.code).toBe("MODERATION_BLOCKED");
    expect(blocked.httpStatus).toBe(429);
  });

  it("timeout: cancela no provedor e devolve os créditos", async () => {
    const userId = await seedUser(100);
    const generation = await service.createGeneration(userId, input(userId), T0);
    const after = await service.refreshGenerationForUser(generation.id, userId, at(31 * 60_000));
    expect(after?.status).toBe("REFUNDED");
    expect(after?.errorCode).toBe("TIMEOUT");
    expect(provider.cancel).toHaveBeenCalledWith("task-1");
    expect(provider.getStatus).not.toHaveBeenCalled();
    expect(await balance(userId)).toEqual({ available: 100, reserved: 0 });
  });

  it("vídeo pronto mas cópia para o storage falhando: tenta de novo e, no timeout, devolve e registra o custo do provedor", async () => {
    const userId = await seedUser(100);
    const generation = await service.createGeneration(userId, input(userId), T0);
    provider.getStatus.mockResolvedValue(status({ state: "SUCCEEDED", outputUrls: ["https://cdn.example.com/out.mp4"] }));
    fetchMock.mockResolvedValue(new Response("erro", { status: 500 }));
    const retry = await service.refreshGenerationForUser(generation.id, userId, at(20_000));
    expect(retry?.status).toBe("SUBMITTED");
    expect(await balance(userId)).toEqual({ available: 0, reserved: 100 });
    const after = await service.refreshGenerationForUser(generation.id, userId, at(31 * 60_000));
    expect(after?.status).toBe("REFUNDED");
    expect(after?.providerCharged).toBe(true);
    expect(await balance(userId)).toEqual({ available: 100, reserved: 0 });
  });

  it("retenção: o cron apaga o MP4 vencido do storage e marca como expirado", async () => {
    const userId = await seedUser(100);
    const generation = await service.createGeneration(userId, input(userId), T0);
    provider.getStatus.mockResolvedValueOnce(status({ state: "SUCCEEDED", outputUrls: ["https://cdn.example.com/out.mp4"] }));
    await service.refreshGenerationForUser(generation.id, userId, at(20_000));
    // Sem compra paga: retenção gratuita (7 dias).
    expect((await service.runAiVideoCron({ now: () => at(6 * 24 * 3600_000) })).expired).toBe(0);
    expect((await service.runAiVideoCron({ now: () => at(8 * 24 * 3600_000) })).expired).toBe(1);
    expect(blobDel).toHaveBeenCalledTimes(1);
    const [row] = await db.sql`select status, storage_video_url from ai_video_generations`;
    expect(row).toEqual({ status: "EXPIRED", storage_video_url: null });
  });
});
