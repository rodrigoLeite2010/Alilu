// @vitest-environment node
// Mídia final padrão — regras contra Postgres real (PGlite): dono = sessão,
// limites validados no servidor, decisão do item final do carrossel
// (automático / explícito / cheio / não configurado), cópia isolada por
// publicação, histórico na publicação e trava contra emendar duas vezes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));
const blobCopy = vi.fn();
vi.mock("@vercel/blob", () => ({
  copy: (...a: unknown[]) => blobCopy(...a),
  put: vi.fn(),
  del: vi.fn(async () => undefined),
}));

const service = await import("@/lib/brand-end-media/backend/end-media-service");
const repo = await import("@/lib/brand-end-media/backend/end-media-repository");

async function seedUser(suffix: string) {
  const [user] = await db.sql`insert into users (email) values (${`end${suffix}@example.com`}) returning id`;
  return user.id as string;
}

async function seedCarouselImage(userId: string) {
  await repo.upsertEndMediaAsset({
    userId,
    slot: "CAROUSEL_IMAGE",
    storageUrl: `https://x.public.blob.vercel-storage.com/brand-end-media/${userId}/cta.jpg`,
    storageKey: `brand-end-media/${userId}/cta.jpg`,
    contentType: "image/jpeg",
    fileSizeBytes: 1000,
    width: 1080,
    height: 1350,
    durationSeconds: null,
    videoCodec: null,
    fps: null,
    hasAudio: false,
  });
}

beforeEach(async () => {
  db = await createTestDb();
  let n = 0;
  blobCopy.mockReset().mockImplementation(async (_from: string, to: string) => ({ url: `https://x.public.blob.vercel-storage.com/${to}?c=${++n}` }));
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.close();
});

const noOverride = async () => {
  throw new Error("não usado");
};

describe("configurações", () => {
  it("empresas antigas nascem desligadas; valores fora do limite são corrigidos no servidor", async () => {
    const user = await seedUser("1");
    expect((await service.getEndMediaSummary(user)).settings).toMatchObject({ carouselEnabled: false, reelEnabled: false, splitEnabled: false, keepAudio: false });
    const saved = await service.updateEndMediaSettings(user, { imageDurationSeconds: 99, fadeSeconds: 3, maxVideoSeconds: 500, reelMediaKind: "XYZ" });
    expect(saved).toMatchObject({ imageDurationSeconds: 10, fadeSeconds: 0.5, maxVideoSeconds: 15, reelMediaKind: "VIDEO" });
  });

  it("cada usuário só vê a própria mídia final", async () => {
    const a = await seedUser("a");
    const b = await seedUser("b");
    await seedCarouselImage(a);
    expect((await service.getEndMediaSummary(a)).assets.CAROUSEL_IMAGE).toBeTruthy();
    expect((await service.getEndMediaSummary(b)).assets.CAROUSEL_IMAGE).toBeUndefined();
  });

  it("recusa arquivo enviado fora da pasta do próprio usuário", async () => {
    const a = await seedUser("c");
    const b = await seedUser("d");
    await expect(
      service.saveUploadedEndMedia(a, { slot: "CAROUSEL_IMAGE", url: `https://x.public.blob.vercel-storage.com/brand-end-media/${b}/x.jpg` }),
    ).rejects.toBeInstanceOf(service.EndMediaValidationError);
    await expect(service.saveUploadedEndMedia(a, { slot: "OUTRO", url: "x" })).rejects.toBeInstanceOf(service.EndMediaValidationError);
  });
});

describe("item final do carrossel", () => {
  it("tela sem a opção: só aplica com carrossel ligado + 'aplicar automaticamente'", async () => {
    const user = await seedUser("e");
    await seedCarouselImage(user);
    expect((await service.resolveCarouselEndForPost(user, undefined, 3, noOverride)).item).toBeNull();
    await service.updateEndMediaSettings(user, { carouselEnabled: true });
    const resolved = await service.resolveCarouselEndForPost(user, undefined, 3, noOverride);
    expect(resolved.item?.mediaId).toBeTruthy();
    // Cópia própria em instagram-media/ (histórico não depende da configuração atual).
    expect(blobCopy.mock.calls[0][1]).toMatch(new RegExp(`^instagram-media/${user}/encerramento-`));
    await service.updateEndMediaSettings(user, { applyAutomatically: false });
    expect((await service.resolveCarouselEndForPost(user, undefined, 3, noOverride)).item).toBeNull();
  });

  it("carrossel já com 10 itens: escolha explícita dá erro claro; automático pula e registra", async () => {
    const user = await seedUser("f");
    await seedCarouselImage(user);
    await service.updateEndMediaSettings(user, { carouselEnabled: true });
    await expect(service.resolveCarouselEndForPost(user, { mode: "default" }, 10, noOverride)).rejects.toThrow(
      "O carrossel já atingiu o número máximo de itens. Remova um item para adicionar a imagem final padrão.",
    );
    const auto = await service.resolveCarouselEndForPost(user, undefined, 10, noOverride);
    expect(auto.item).toBeNull();
    expect(auto.notApplied).toMatch(/número máximo/);
  });

  it("mídia não configurada nunca bloqueia; 'none' não adiciona; override usa outra imagem só nesta publicação", async () => {
    const user = await seedUser("g");
    const missing = await service.resolveCarouselEndForPost(user, { mode: "default" }, 3, noOverride);
    expect(missing).toEqual({ item: null, notApplied: "Mídia final padrão não configurada." });
    expect((await service.resolveCarouselEndForPost(user, { mode: "none" }, 3, noOverride)).item).toBeNull();

    const [media] = await db.sql`insert into instagram_media (user_id, storage_url, media_type) values (${user}, 'https://x/b.jpg', 'image') returning id`;
    const override = await service.resolveCarouselEndForPost(user, { mode: "override", mediaUrl: "https://x/b.jpg" }, 3, async () => media.id as string);
    expect(override.item).toEqual({ mediaId: media.id, urlUsed: "https://x/b.jpg", sourceAssetId: null });
    expect((await service.getEndMediaSummary(user)).assets.CAROUSEL_IMAGE).toBeUndefined();
  });
});

describe("histórico e trava contra duplicar", () => {
  it("grava o que foi usado na publicação; vídeo que já é resultado com encerramento não é emendado de novo", async () => {
    const user = await seedUser("h");
    const [account] = await db.sql`
      insert into instagram_accounts (user_id, ig_user_id, ig_username, access_token_encrypted)
      values (${user}, 'ig-h', 'conta', 'enc') returning id`;
    const [source] = await db.sql`insert into instagram_media (user_id, storage_url, media_type) values (${user}, 'https://x/src.mp4', 'video') returning id`;
    const [result] = await db.sql`insert into instagram_media (user_id, storage_url, media_type) values (${user}, 'https://x/final.mp4', 'video') returning id`;
    const render = await repo.insertRender({
      userId: user,
      context: "REEL",
      sourceMediaId: source.id as string,
      endKey: "k1",
      endMediaType: "VIDEO",
      endMediaUrl: "https://x/cta.mp4",
      resultUrl: "https://x/final.mp4",
      resultMediaId: result.id as string,
      processingMs: 10,
    });
    // Mesmo vídeo + mesmo encerramento → cache (nunca processa de novo).
    expect((await repo.findCachedRender(user, source.id as string, "k1"))?.id).toBe(render.id);
    // Retry com o vídeo FINAL: devolve ele mesmo, sem nova emenda (vídeo + CTA + CTA nunca acontece).
    const again = await service.applyEndMediaToVideoMedia(user, result.id as string, { context: "REEL" });
    expect(again).toMatchObject({ resultMediaId: result.id, cached: true });

    const [post] = await db.sql`
      insert into instagram_posts (user_id, instagram_account_id, post_type) values (${user}, ${account.id}, 'reels') returning id`;
    await repo.markPostEndMedia(post.id as string, user, { applied: true, type: "VIDEO", urlUsed: "https://x/cta.mp4", error: null });
    const [row] = await db.sql`select end_media_applied, end_media_type, end_media_url_used from instagram_posts where id = ${post.id}`;
    expect(row).toEqual({ end_media_applied: true, end_media_type: "VIDEO", end_media_url_used: "https://x/cta.mp4" });
    // Outro usuário não consegue ler o registro nem marcar o post.
    const other = await seedUser("i");
    expect(await repo.getRenderForUser(render.id, other)).toBeNull();
  });
});
