// @vitest-environment node
//
// Meta App Review — fluxo do painel com Postgres REAL (PGlite) e o
// publicador EXISTENTE do Alilu. Só a rede da Meta é simulada.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedUserWithAccount, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));
vi.mock("@/lib/instagram/backend/encryption", () => ({
  decryptSecret: (value: string) => `plain:${value}`,
  encryptSecret: (value: string) => `enc:${value}`,
}));
const admin = { session: null as null | { userId: string; email: string } };
vi.mock("@/lib/admin/admin-access", () => ({ getAdminSession: async () => admin.session, isAdminEmail: () => true }));

const graph = {
  createReelMediaContainer: vi.fn(),
  getMediaContainerStatus: vi.fn(),
  publishMediaContainer: vi.fn(),
  fetchInstagramProfileDetails: vi.fn(),
  fetchPublishedMedia: vi.fn(),
};
vi.mock("@/lib/instagram/backend/meta-graph-client", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    ...Object.fromEntries(Object.keys(graph).map((key) => [key, (...args: unknown[]) => (graph as Record<string, (...a: unknown[]) => unknown>)[key](...args)])),
  };
});

const service = await import("@/lib/instagram/backend/meta-app-review-service");
const posts = await import("@/lib/instagram/backend/instagram-post-service");
const publisher = await import("@/lib/instagram/backend/instagram-publish-service");
const route = await import("@/app/api/admin/meta-app-review/route");
const { InstagramGraphApiError } = await import("@/lib/instagram/backend/meta-graph-client");

type Seed = Awaited<ReturnType<typeof seedUserWithAccount>>;
const SCOPES = "instagram_business_basic,instagram_business_content_publish";

/** O que o OAuth EXISTENTE (testado em instagram-oauth-callback-route) grava ao conectar. */
async function simulateConnectedByOAuth(seed: Seed) {
  await db.sql`update instagram_accounts set scopes = ${SCOPES}, ig_user_id = '1784', updated_at = now() + interval '1 second' where id = ${seed.accountId}`;
  for (const message of ["OAUTH_START", "CODE_RECEIVED"]) {
    await db.sql`insert into instagram_oauth_events (user_id, stage, outcome, message, created_at) values (${seed.userId}, 'x', 'info', ${message}, now() + interval '1 second')`;
  }
  await db.sql`insert into instagram_oauth_events (user_id, stage, outcome, message, created_at) values (${seed.userId}, 'complete', 'success', 'OAUTH_SUCCESS', now() + interval '1 second')`;
}

const publishNow = (postId: string, userId: string) => publisher.publishInstagramPublication(postId, userId, { trigger: "manual", pollIntervalMs: 1 });
const doneKeys = async (userId: string) => (await service.getReviewOverview(userId)).checklist.filter((item) => item.done).map((item) => item.key);

beforeEach(async () => {
  db = await createTestDb();
  Object.values(graph).forEach((fn) => fn.mockReset());
  graph.createReelMediaContainer.mockResolvedValue("container-1");
  graph.getMediaContainerStatus.mockResolvedValue("FINISHED");
  graph.publishMediaContainer.mockResolvedValue("17890001");
  graph.fetchInstagramProfileDetails.mockResolvedValue({
    userId: "1784",
    username: "gta6br",
    name: null,
    accountType: "MEDIA_CREATOR",
    profilePictureUrl: null,
    mediaCount: 3,
    returnedFields: ["user_id", "username", "account_type", "media_count"],
  });
  graph.fetchPublishedMedia.mockResolvedValue({ id: "17890001", permalink: "https://www.instagram.com/reel/ABC/", timestamp: "2026-11-17T12:00:00+0000", mediaType: "VIDEO", mediaProductType: "REELS", shortcode: "ABC" });
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  await db.close();
  admin.session = null;
  vi.restoreAllMocks();
});

describe("painel Meta App Review", () => {
  it("fluxo completo: conta → consulta real → Reel → publicador existente → confirmação na API", async () => {
    const seed = await seedUserWithAccount(db);
    await service.startRecordingSession(seed.userId);
    expect(await doneKeys(seed.userId)).toEqual([]);
    await simulateConnectedByOAuth(seed);

    expect(await service.refreshAccountProfile(seed.userId, seed.accountId)).toMatchObject({ ok: true, profile: { username: "gta6br" } });
    expect(graph.fetchInstagramProfileDetails).toHaveBeenCalledWith("plain:cifrado", "instagram_login");

    const postId = await posts.createReelPost({ userId: seed.userId, mediaId: seed.videoId, caption: "Meu Reel original #GTA6", instagramAccountId: seed.accountId });
    await service.setDemoPost(seed.userId, postId);
    // Rascunho: nada foi publicado, nenhum sucesso antecipado.
    expect(await service.verifyDemoPublication(seed.userId)).toMatchObject({ ok: false });
    expect(graph.createReelMediaContainer).not.toHaveBeenCalled();

    expect(await publishNow(postId, seed.userId)).toBe("PUBLISHED");
    // Duplicidade: segundo clique não republica.
    expect(await publishNow(postId, seed.userId)).toBe("PUBLISHED");
    expect(graph.publishMediaContainer).toHaveBeenCalledTimes(1);

    expect(await service.verifyDemoPublication(seed.userId)).toMatchObject({ ok: true, media: { permalink: "https://www.instagram.com/reel/ABC/" } });
    expect(graph.fetchPublishedMedia).toHaveBeenCalledWith("17890001", "plain:cifrado", "instagram_login");

    const overview = await service.getReviewOverview(seed.userId);
    expect(overview.post).toMatchObject({ status: "PUBLISHED", metaMediaId: "17890001" });
    expect(overview.permissions.map((row) => row.grantedByUser)).toEqual([true, true]);
    expect(JSON.stringify(overview)).not.toMatch(/cifrado|plain:/);
    expect(overview.checklist.filter((item) => !item.manual).every((item) => item.done)).toBe(true);
    expect(overview.checklist.filter((item) => item.manual).every((item) => !item.done)).toBe(true);

    await service.setManualCheck(seed.userId, "reel_viewed", true);
    expect(await doneKeys(seed.userId)).toContain("reel_viewed");
    await expect(service.setManualCheck(seed.userId, "publish_confirmed", true)).rejects.toMatchObject({ code: "NOT_MANUAL" });

    // Nova sessão zera tudo (só conta o que for gravado de novo).
    await service.startRecordingSession(seed.userId, new Date(Date.now() + 60_000));
    expect(await doneKeys(seed.userId)).toEqual([]);
  });

  it("processamento da Meta: só confirma depois de publicado, sem novo contêiner", async () => {
    const seed = await seedUserWithAccount(db);
    await service.startRecordingSession(seed.userId);
    graph.getMediaContainerStatus.mockResolvedValue("IN_PROGRESS");
    const postId = await posts.createReelPost({ userId: seed.userId, mediaId: seed.videoId, caption: "x", instagramAccountId: seed.accountId });
    await service.setDemoPost(seed.userId, postId);
    expect(await publishNow(postId, seed.userId)).toBe("PROCESSING");
    expect(await service.verifyDemoPublication(seed.userId)).toMatchObject({ ok: false });
    expect(graph.publishMediaContainer).not.toHaveBeenCalled();
    graph.getMediaContainerStatus.mockResolvedValue("FINISHED");
    await db.sql`update instagram_posts set processing_lock_expires_at = now() - interval '1 second' where id = ${postId}`;
    expect(await publishNow(postId, seed.userId)).toBe("PUBLISHED");
    expect(graph.createReelMediaContainer).toHaveBeenCalledTimes(1);
    expect(await service.verifyDemoPublication(seed.userId)).toMatchObject({ ok: true });
  });

  it("falha da Meta no processamento aparece como falha (nunca como sucesso)", async () => {
    const seed = await seedUserWithAccount(db);
    await service.startRecordingSession(seed.userId);
    graph.getMediaContainerStatus.mockResolvedValue("ERROR");
    const postId = await posts.createReelPost({ userId: seed.userId, mediaId: seed.videoId, caption: "x", instagramAccountId: seed.accountId });
    await service.setDemoPost(seed.userId, postId);
    await expect(publishNow(postId, seed.userId)).rejects.toBeInstanceOf(publisher.InstagramPublishError);
    const overview = await service.getReviewOverview(seed.userId);
    expect(overview.post?.status).toBe("FAILED");
    expect(overview.lastMetaError).toBeTruthy();
    expect(overview.checklist.find((item) => item.key === "publish_executed")?.done).toBe(false);
  });

  it("token inválido/expirado e conta desconectada aparecem no diagnóstico", async () => {
    const seed = await seedUserWithAccount(db);
    await service.startRecordingSession(seed.userId);
    graph.fetchInstagramProfileDetails.mockRejectedValueOnce(new InstagramGraphApiError("x", { error: { message: "Error validating access token: Session has expired", code: 190, error_subcode: 463 } }));
    const failed = await service.refreshAccountProfile(seed.userId, seed.accountId);
    expect(failed).toMatchObject({ ok: false });
    expect((failed as { error: string }).error).toMatch(/expired.*code 190.*subcode 463/);
    expect((await service.getReviewOverview(seed.userId)).lastMetaError).toMatch(/code 190/);

    await db.sql`update instagram_accounts set status = 'expired' where id = ${seed.accountId}`;
    expect(await service.refreshAccountProfile(seed.userId, seed.accountId)).toMatchObject({ ok: false, error: expect.stringMatching(/não está conectada/) });
    expect(graph.fetchInstagramProfileDetails).toHaveBeenCalledTimes(1);
  });

  it("isola usuários e exige administrador na API (sem tokens na resposta)", async () => {
    const owner = await seedUserWithAccount(db, "1");
    const other = await seedUserWithAccount(db, "2");
    const postId = await posts.createReelPost({ userId: owner.userId, mediaId: owner.videoId, caption: "x", instagramAccountId: owner.accountId });
    await expect(service.setDemoPost(other.userId, postId)).rejects.toMatchObject({ httpStatus: 404 });
    await expect(service.refreshAccountProfile(other.userId, owner.accountId)).rejects.toMatchObject({ httpStatus: 404 });

    expect((await route.GET()).status).toBe(404);
    expect((await route.POST(new Request("https://alilu.com.br/api/admin/meta-app-review", { method: "POST", body: JSON.stringify({ action: "start_session" }) }))).status).toBe(404);
    admin.session = { userId: owner.userId, email: "admin@example.com" };
    const response = await route.GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.config.requestedScopes).toEqual(["instagram_business_basic", "instagram_business_content_publish"]);
    expect(JSON.stringify(body)).not.toMatch(/cifrado|access_token|secret/i);
  });
});
