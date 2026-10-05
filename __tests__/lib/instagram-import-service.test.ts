// Importar do Instagram — fluxo completo contra Postgres real em memória (PGlite).
// Provedor e download são falsos; a validação do arquivo usa o ffprobe de verdade.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";
import { makeLogoPng, makeSolidMp4 } from "../helpers/ai-video-media";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));
const blobPut = vi.fn();
const blobDel = vi.fn();
vi.mock("@vercel/blob", () => ({ put: (...a: unknown[]) => blobPut(...a), del: (...a: unknown[]) => blobDel(...a) }));
const downloadMock = vi.fn();
vi.mock("@/lib/instagram-import/backend/safe-download", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/instagram-import/backend/safe-download")>();
  return { ...original, safeDownload: (...a: unknown[]) => downloadMock(...a) };
});

const service = await import("@/lib/instagram-import/backend/import-service");
const registry = await import("@/lib/instagram-import/backend/providers/provider-registry");
const { InstagramImportProviderError } = await import("@/lib/instagram-import/backend/providers/provider");
const { SafeDownloadError } = await import("@/lib/instagram-import/backend/safe-download");

const REEL = "https://www.instagram.com/reel/DbDp7T4olyC/?igsh=abc";
const MP4 = makeSolidMp4({ width: 360, height: 640, seconds: 2 });
const resolveMock = vi.fn();

async function seedUser(suffix = "1") {
  const [user] = await db.sql`insert into users (email) values (${`import${suffix}@example.com`}) returning id`;
  return user.id as string;
}

const video = (url = "https://scontent.cdninstagram.com/v.mp4") => ({
  provider: "fake",
  requestId: "r1",
  items: [{ mediaType: "VIDEO" as const, mediaUrl: url, thumbnailUrl: "https://scontent.cdninstagram.com/t.jpg", contentType: "video/mp4" }],
  title: null,
  durationSeconds: null,
  width: null,
  height: null,
});

beforeEach(async () => {
  db = await createTestDb();
  resolveMock.mockReset().mockResolvedValue(video());
  registry.__setInstagramImportProviderForTests({ id: "fake", resolve: resolveMock });
  downloadMock.mockReset().mockResolvedValue({ buffer: MP4, contentType: "video/mp4", finalUrl: "x" });
  blobPut.mockReset().mockImplementation(async (pathname: string) => ({ url: `https://abc.public.blob.vercel-storage.com/${pathname}`, pathname }));
  blobDel.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  registry.__setInstagramImportProviderForTests(null);
  vi.restoreAllMocks();
  await db.close();
});

describe("resolver o link", () => {
  it("exige a declaração de autorização", async () => {
    const userId = await seedUser();
    await expect(service.resolveInstagramLink(userId, { url: REEL, authorized: false })).rejects.toMatchObject({ code: "AUTHORIZATION_REQUIRED" });
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it("Reel público válido → prévia (READY) com o link normalizado", async () => {
    const userId = await seedUser();
    const { record, duplicate } = await service.resolveInstagramLink(userId, { url: REEL, authorized: true });
    expect(duplicate).toBeNull();
    expect(record).toMatchObject({ status: "READY", urlKind: "reel", normalizedUrl: "https://www.instagram.com/reel/DbDp7T4olyC/", mediaType: "VIDEO" });
    expect(resolveMock).toHaveBeenCalledWith("https://www.instagram.com/reel/DbDp7T4olyC/");
  });

  it("URL inválida ou de outro domínio: recusada sem chamar o provedor (e registrada)", async () => {
    const userId = await seedUser();
    await expect(service.resolveInstagramLink(userId, { url: "https://evil.com/reel/DbDp7T4olyC/", authorized: true })).rejects.toMatchObject({ code: "INVALID_URL", httpStatus: 400 });
    await expect(service.resolveInstagramLink(userId, { url: "https://www.instagram.com/stories/x/1/", authorized: true })).rejects.toMatchObject({ code: "UNSUPPORTED" });
    expect(resolveMock).not.toHaveBeenCalled();
    const rows = await db.sql`select status from instagram_media_imports order by created_at`;
    expect(rows.map((r) => r.status)).toEqual(["INVALID_URL", "UNSUPPORTED"]);
  });

  it.each([
    ["PRIVATE_CONTENT", "PRIVATE_CONTENT", 422],
    ["NOT_FOUND", "PRIVATE_CONTENT", 422],
    ["UNSUPPORTED", "UNSUPPORTED", 422],
    ["PROVIDER_FAILED", "FAILED", 502],
  ])("provedor responde %s → status %s, com upload manual oferecido", async (code, status, http) => {
    const userId = await seedUser();
    resolveMock.mockRejectedValueOnce(new InstagramImportProviderError("x", code as never, false));
    await expect(service.resolveInstagramLink(userId, { url: REEL, authorized: true })).rejects.toMatchObject({ code: status, httpStatus: http, details: { manualUpload: true } });
    const [row] = await db.sql`select status, error_code from instagram_media_imports`;
    expect(row).toEqual({ status, error_code: code });
  });

  it("limite diário de importações", async () => {
    const userId = await seedUser();
    await db.sql`update instagram_import_settings set max_imports_per_day = 2`;
    await service.resolveInstagramLink(userId, { url: REEL, authorized: true });
    await service.resolveInstagramLink(userId, { url: "https://www.instagram.com/p/C1a2B3c4D5e/", authorized: true });
    await expect(service.resolveInstagramLink(userId, { url: "https://www.instagram.com/p/C9a2B3c4D5e/", authorized: true })).rejects.toMatchObject({ code: "DAILY_LIMIT", httpStatus: 429 });
  });
});

describe("importar para o Alilu", () => {
  it("vídeo: baixa, valida com ffprobe, guarda no Blob do Alilu e descarta as URLs temporárias", async () => {
    const userId = await seedUser();
    const { record } = await service.resolveInstagramLink(userId, { url: REEL, authorized: true });
    const done = await service.importResolvedMedia(userId, record!.id, { itemIndex: 0 });
    expect(done).toMatchObject({ status: "COMPLETED", mediaType: "VIDEO", width: 360, height: 640, videoCodec: "h264", contentType: "video/mp4" });
    expect(done.durationSeconds).toBeGreaterThan(1.5);
    expect(done.importedFileUrl).toContain(`videos/imports/${userId}/`);
    expect(done.resolvedItems).toEqual([]);
    expect(downloadMock.mock.calls[0][0]).toBe("https://scontent.cdninstagram.com/v.mp4");
    expect(downloadMock.mock.calls[0][1]).toMatchObject({ maxBytes: 100 * 1024 * 1024 });
  });

  it("post com imagem", async () => {
    const userId = await seedUser();
    resolveMock.mockResolvedValueOnce({ ...video(), items: [{ mediaType: "IMAGE", mediaUrl: "https://scontent.cdninstagram.com/a.jpg", thumbnailUrl: null, contentType: "image/png" }] });
    downloadMock.mockResolvedValueOnce({ buffer: makeLogoPng(), contentType: "image/png", finalUrl: "x" });
    const { record } = await service.resolveInstagramLink(userId, { url: "https://www.instagram.com/p/C1a2B3c4D5e/", authorized: true });
    const done = await service.importResolvedMedia(userId, record!.id, {});
    expect(done).toMatchObject({ status: "COMPLETED", mediaType: "IMAGE", width: 200, height: 80 });
  });

  it("arquivo grande demais, vídeo inválido, longo demais e download interrompido → FAILED com mensagem amigável", async () => {
    const userId = await seedUser();
    const cases: Array<[() => void, string]> = [
      [() => downloadMock.mockRejectedValueOnce(new SafeDownloadError("x", "TOO_LARGE")), "TOO_LARGE"],
      [() => downloadMock.mockResolvedValueOnce({ buffer: Buffer.from("não é vídeo".repeat(500)), contentType: "video/mp4", finalUrl: "x" }), "INVALID_MEDIA"],
      [() => downloadMock.mockRejectedValueOnce(new SafeDownloadError("x", "INTERRUPTED")), "INTERRUPTED"],
      [() => downloadMock.mockRejectedValueOnce(new SafeDownloadError("x", "BLOCKED_URL")), "BLOCKED_URL"],
    ];
    for (const [setup, code] of cases) {
      const { record } = await service.resolveInstagramLink(userId, { url: REEL, authorized: true, force: true });
      setup();
      await expect(service.importResolvedMedia(userId, record!.id, {})).rejects.toMatchObject({ code, details: { manualUpload: true } });
      const [row] = await db.sql`select status, error_code from instagram_media_imports where id = ${record!.id}`;
      expect(row).toEqual({ status: "FAILED", error_code: code });
    }
    await db.sql`update instagram_import_settings set max_imported_duration_minutes = 1`;
    downloadMock.mockResolvedValueOnce({ buffer: makeSolidMp4({ seconds: 65 }), contentType: "video/mp4", finalUrl: "x" });
    const { record } = await service.resolveInstagramLink(userId, { url: REEL, authorized: true, force: true });
    await expect(service.importResolvedMedia(userId, record!.id, {})).rejects.toMatchObject({ code: "TOO_LONG", httpStatus: 413 });
    expect(blobPut).not.toHaveBeenCalled();
  }, 90_000);

  it("dois cliques em 'Importar' baixam uma vez só; outro usuário não acessa", async () => {
    const userId = await seedUser();
    const other = await seedUser("2");
    const { record } = await service.resolveInstagramLink(userId, { url: REEL, authorized: true });
    await expect(service.importResolvedMedia(other, record!.id, {})).rejects.toMatchObject({ httpStatus: 404 });
    const results = await Promise.allSettled([service.importResolvedMedia(userId, record!.id, {}), service.importResolvedMedia(userId, record!.id, {})]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(downloadMock).toHaveBeenCalledTimes(1);
    expect(blobPut).toHaveBeenCalledTimes(1);
  });

  it("duplicidade: o mesmo link já importado é oferecido de novo; 'importar novamente' força nova consulta", async () => {
    const userId = await seedUser();
    const { record } = await service.resolveInstagramLink(userId, { url: REEL, authorized: true });
    await service.importResolvedMedia(userId, record!.id, {});
    const again = await service.resolveInstagramLink(userId, { url: "https://instagram.com/reel/DbDp7T4olyC", authorized: true });
    expect(again.record).toBeNull();
    expect(again.duplicate?.id).toBe(record!.id);
    expect(resolveMock).toHaveBeenCalledTimes(1);
    const forced = await service.resolveInstagramLink(userId, { url: REEL, authorized: true, force: true });
    expect(forced.record?.status).toBe("READY");
    expect(resolveMock).toHaveBeenCalledTimes(2);
  });

  it("excluir apaga o registro e o arquivo", async () => {
    const userId = await seedUser();
    const { record } = await service.resolveInstagramLink(userId, { url: REEL, authorized: true });
    const done = await service.importResolvedMedia(userId, record!.id, {});
    expect(await service.deleteInstagramImport(userId, done.id)).toBe(true);
    expect(blobDel).toHaveBeenCalledWith(done.importedFileUrl);
    expect(await db.sql`select id from instagram_media_imports where id = ${done.id}`).toHaveLength(0);
  });
});

describe("carrossel (fotos + vídeos)", () => {
  const CAROUSEL = "https://www.instagram.com/p/C1a2B3c4D5e/";
  const carousel = () => ({
    ...video(),
    items: [
      { mediaType: "IMAGE" as const, mediaUrl: "https://scontent.cdninstagram.com/a.png", thumbnailUrl: null, contentType: "image/png" },
      { mediaType: "VIDEO" as const, mediaUrl: "https://scontent.cdninstagram.com/v.mp4", thumbnailUrl: null, contentType: "video/mp4" },
    ],
  });

  beforeEach(() => {
    resolveMock.mockResolvedValue(carousel());
    downloadMock.mockImplementation(async (url: string) =>
      url.endsWith(".png")
        ? { buffer: makeLogoPng(), contentType: "image/png", finalUrl: url }
        : { buffer: MP4, contentType: "video/mp4", finalUrl: url },
    );
  });

  it("importa item a item (imagem vira JPEG), conclui ao final e repetir o item não duplica", async () => {
    const userId = await seedUser();
    const { record } = await service.resolveInstagramLink(userId, { url: CAROUSEL, authorized: true });

    const afterFirst = await service.importCarouselItem(userId, record!.id, { itemIndex: 0 });
    expect(afterFirst.status).toBe("READY");
    expect(afterFirst.importedItems).toHaveLength(1);
    expect(afterFirst.importedItems[0]).toMatchObject({ index: 0, mediaType: "IMAGE", contentType: "image/jpeg" });
    expect(blobPut.mock.calls[0][0]).toMatch(new RegExp(`^videos/imports/${userId}/.+-1\\.jpg$`));

    const again = await service.importCarouselItem(userId, record!.id, { itemIndex: 0 });
    expect(again.importedItems).toHaveLength(1);
    expect(blobPut).toHaveBeenCalledTimes(1);

    const done = await service.importCarouselItem(userId, record!.id, { itemIndex: 1 });
    expect(done.status).toBe("COMPLETED");
    expect(done.importedItems.map((i) => [i.index, i.mediaType])).toEqual([[0, "IMAGE"], [1, "VIDEO"]]);
    expect(done.importedFileUrl).toBe(done.importedItems[0].fileUrl);
    expect(done.resolvedItems).toEqual([]);

    expect(await service.deleteInstagramImport(userId, done.id)).toBe(true);
    for (const imported of done.importedItems) expect(blobDel).toHaveBeenCalledWith(imported.fileUrl);
  });

  it("outro usuário não importa itens; concluir sem um item (pulado) usa os que já vieram", async () => {
    const userId = await seedUser();
    const other = await seedUser("2");
    const { record } = await service.resolveInstagramLink(userId, { url: CAROUSEL, authorized: true });
    await expect(service.importCarouselItem(other, record!.id, { itemIndex: 0 })).rejects.toMatchObject({ code: "NOT_FOUND" });

    await service.importCarouselItem(userId, record!.id, { itemIndex: 1 });
    const done = await service.finishCarouselImport(userId, record!.id);
    expect(done.status).toBe("COMPLETED");
    expect(done.importedItems.map((i) => i.index)).toEqual([1]);
    expect(done.mediaType).toBe("VIDEO");
  });
});

describe("upload manual (fallback)", () => {
  it("aceita só arquivo enviado pela tela, no prefixo do próprio usuário, e valida o conteúdo", async () => {
    const userId = await seedUser();
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => new Response(new Uint8Array(MP4), { status: 200, headers: { "Content-Type": "video/mp4" } })) as unknown as typeof fetch;
    try {
      await expect(service.registerManualUpload(userId, { blobUrl: "https://evil.com/x.mp4", authorized: true })).rejects.toMatchObject({ code: "INVALID_UPLOAD" });
      await expect(
        service.registerManualUpload(userId, { blobUrl: `https://abc.public.blob.vercel-storage.com/videos/imports/outro/manual/x.mp4`, authorized: true }),
      ).rejects.toMatchObject({ code: "INVALID_UPLOAD" });
      const done = await service.registerManualUpload(userId, {
        blobUrl: `https://abc.public.blob.vercel-storage.com/videos/imports/${userId}/manual/upload-x.mp4`,
        authorized: true,
        originalUrl: REEL,
      });
      expect(done).toMatchObject({ status: "COMPLETED", provider: "manual", mediaType: "VIDEO", normalizedUrl: "https://www.instagram.com/reel/DbDp7T4olyC/" });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
