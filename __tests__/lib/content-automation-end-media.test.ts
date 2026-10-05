// @vitest-environment node
// Piloto Automático + mídia final padrão (Postgres real em memória):
// carrossel reserva 1 slide e termina com a imagem da empresa; Reel usa o
// vídeo já com encerramento; falha → nova tentativa → publica sem ele.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUserWithAccount, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));
const fakeProvider = { generatePost: vi.fn(), generateReel: vi.fn() };
vi.mock("@/lib/content-automation/backend/provider-factory", () => ({ getContentAIProvider: () => fakeProvider }));
const fakeCarousel = vi.fn();
vi.mock("@/lib/instagram/backend/template-render-service", () => ({
  renderAndStoreAutomationArt: vi.fn(),
  renderAndStoreAutomationCarousel: (...args: unknown[]) => fakeCarousel(...args),
}));
vi.mock("@vercel/blob", () => ({
  copy: async (_from: string, to: string) => ({ url: `https://x.public.blob.vercel-storage.com/${to}` }),
  put: vi.fn(),
  del: vi.fn(async () => undefined),
}));
const fakeApply = vi.fn();
vi.mock("@/lib/brand-end-media/backend/end-media-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/brand-end-media/backend/end-media-service")>();
  return { ...original, applyEndMediaToVideoMedia: (...args: unknown[]) => fakeApply(...args) };
});

const repo = await import("@/lib/content-automation/backend/automation-repository");
const cron = await import("@/lib/content-automation/backend/content-automation-cron");
const endRepo = await import("@/lib/brand-end-media/backend/end-media-repository");
const endService = await import("@/lib/brand-end-media/backend/end-media-service");

const now = () => new Date("2026-09-23T20:00:00.000Z"); // quarta 17h em SP

async function seedAsset(userId: string, slot: "CAROUSEL_IMAGE" | "REEL_VIDEO") {
  await endRepo.upsertEndMediaAsset({
    userId,
    slot,
    storageUrl: `https://x.public.blob.vercel-storage.com/brand-end-media/${userId}/${slot}`,
    storageKey: `brand-end-media/${userId}/${slot}`,
    contentType: slot === "REEL_VIDEO" ? "video/mp4" : "image/jpeg",
    fileSizeBytes: 1000,
    width: 1080,
    height: 1920,
    durationSeconds: slot === "REEL_VIDEO" ? 3 : null,
    videoCodec: null,
    fps: null,
    hasAudio: false,
  });
}

async function activeAutomation(seed: Awaited<ReturnType<typeof seedUserWithAccount>>, contentType: "CAROUSEL" | "REEL") {
  const automationId = await repo.createAutomation({
    userId: seed.userId,
    instagramAccountId: seed.accountId,
    name: "Teste encerramento",
    description: "",
    timezone: "America/Sao_Paulo",
    brandContext: "",
    autoPublish: false,
    requireApproval: true,
    generationLeadMinutes: 120,
    imageMode: "AUTO_TEMPLATE",
    fixedImageMediaId: seed.mediaId,
    videoSelection: "FIXED",
    fixedVideoMediaId: seed.videoId,
  });
  await repo.updateAutomationDay(automationId, seed.userId, "WEDNESDAY" as never, {
    enabled: true,
    contentType,
    contentMode: "MANUAL",
    prompt: "",
    manualCaption: "Legenda manual",
    visualText: contentType === "CAROUSEL" ? "Texto longo para virar vários slides do carrossel automático." : undefined,
    publishTime: "19:00",
  });
  await repo.setAutomationStatus(automationId, seed.userId, "ACTIVE");
}

beforeEach(async () => {
  db = await createTestDb();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(async () => {
  fakeCarousel.mockReset();
  fakeApply.mockReset();
  vi.restoreAllMocks();
  await db.close();
});

describe("carrossel automático", () => {
  it("encerramento ligado: gera até 9 slides e a imagem da empresa entra como ÚLTIMO item", async () => {
    const seed = await seedUserWithAccount(db);
    await seedAsset(seed.userId, "CAROUSEL_IMAGE");
    await endService.updateEndMediaSettings(seed.userId, { carouselEnabled: true });
    const slides: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const [row] = await db.sql`insert into instagram_media (user_id, storage_url, media_type) values (${seed.userId}, ${`https://b/s${i}.jpg`}, 'image') returning id`;
      slides.push(row.id as string);
    }
    fakeCarousel.mockResolvedValue({ mediaIds: slides, overflowText: null });
    await activeAutomation(seed, "CAROUSEL");

    const [result] = await cron.runContentAutomationCron({ now });
    expect(result.status).toBe("WAITING_APPROVAL");
    expect(fakeCarousel.mock.calls[0][0]).toMatchObject({ maxSlides: 9 });
    const [run] = await db.sql`select publication_id from automation_runs`;
    const items = await db.sql`select i.media_id, m.storage_url from instagram_post_items i join instagram_media m on m.id = i.media_id where post_id = ${run.publication_id} order by position`;
    expect(items).toHaveLength(4);
    expect(items.slice(0, 3).map((item) => item.media_id)).toEqual(slides);
    expect(String(items[3].storage_url)).toContain(`instagram-media/${seed.userId}/encerramento-`);
    const [post] = await db.sql`select end_media_applied, end_media_type from instagram_posts where id = ${run.publication_id}`;
    expect(post).toEqual({ end_media_applied: true, end_media_type: "IMAGE" });
  });

  it("encerramento desligado: comportamento de sempre (10 slides, sem imagem final)", async () => {
    const seed = await seedUserWithAccount(db);
    await seedAsset(seed.userId, "CAROUSEL_IMAGE");
    const [a] = await db.sql`insert into instagram_media (user_id, storage_url, media_type) values (${seed.userId}, 'https://b/a.jpg', 'image') returning id`;
    const [b] = await db.sql`insert into instagram_media (user_id, storage_url, media_type) values (${seed.userId}, 'https://b/b.jpg', 'image') returning id`;
    fakeCarousel.mockResolvedValue({ mediaIds: [a.id, b.id], overflowText: null });
    await activeAutomation(seed, "CAROUSEL");
    await cron.runContentAutomationCron({ now });
    expect(fakeCarousel.mock.calls[0][0]).toMatchObject({ maxSlides: 10 });
    const [run] = await db.sql`select publication_id from automation_runs`;
    expect(await db.sql`select 1 from instagram_post_items where post_id = ${run.publication_id}`).toHaveLength(2);
  });
});

describe("Reel automático", () => {
  it("usa o vídeo já com encerramento e grava o histórico", async () => {
    const seed = await seedUserWithAccount(db);
    await seedAsset(seed.userId, "REEL_VIDEO");
    await endService.updateEndMediaSettings(seed.userId, { reelEnabled: true });
    const [final] = await db.sql`insert into instagram_media (user_id, storage_url, media_type) values (${seed.userId}, 'https://b/final.mp4', 'video') returning id`;
    fakeApply.mockResolvedValue({
      render: { endMediaType: "VIDEO", endMediaUrl: "https://cta.mp4" },
      resultMediaId: final.id,
      resultUrl: "https://b/final.mp4",
      cached: false,
    });
    await activeAutomation(seed, "REEL");
    const [result] = await cron.runContentAutomationCron({ now });
    expect(result.status).toBe("WAITING_APPROVAL");
    expect(fakeApply).toHaveBeenCalledWith(seed.userId, seed.videoId, expect.objectContaining({ context: "AUTOMATION_REEL" }));
    const [run] = await db.sql`select publication_id from automation_runs`;
    const [item] = await db.sql`select media_id from instagram_post_items where post_id = ${run.publication_id}`;
    expect(item.media_id).toBe(final.id);
    const [post] = await db.sql`select end_media_applied, end_media_url_used from instagram_posts where id = ${run.publication_id}`;
    expect(post).toEqual({ end_media_applied: true, end_media_url_used: "https://cta.mp4" });
  });

  it("falha ao emendar: 1ª vez agenda nova tentativa; na 2ª publica SEM encerramento e registra o alerta", async () => {
    const seed = await seedUserWithAccount(db);
    await seedAsset(seed.userId, "REEL_VIDEO");
    await endService.updateEndMediaSettings(seed.userId, { reelEnabled: true });
    fakeApply.mockRejectedValue(new Error("ffmpeg quebrou"));
    await activeAutomation(seed, "REEL");

    await cron.runContentAutomationCron({ now });
    const [firstRun] = await db.sql`select status, publication_id, generation_attempt from automation_runs`;
    expect(firstRun.publication_id).toBeNull();
    expect(Number(firstRun.generation_attempt)).toBe(1);

    await db.sql`update automation_runs set next_attempt_at = now() - interval '1 minute'`;
    await cron.runContentAutomationCron({ now });
    const [secondRun] = await db.sql`select publication_id from automation_runs`;
    expect(secondRun.publication_id).toBeTruthy();
    const [item] = await db.sql`select media_id from instagram_post_items where post_id = ${secondRun.publication_id}`;
    expect(item.media_id).toBe(seed.videoId);
    const [post] = await db.sql`select end_media_applied, end_media_error from instagram_posts where id = ${secondRun.publication_id}`;
    expect(post).toEqual({ end_media_applied: false, end_media_error: "Não foi possível adicionar o encerramento padrão." });
    const events = await db.sql`select applied from end_media_events where context = 'AUTOMATION_REEL'`;
    expect(events.length).toBe(2);
  });
});
