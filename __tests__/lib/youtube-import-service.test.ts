// Importar do YouTube — fluxo completo contra Postgres real em memória (PGlite).
// A API do YouTube e o Blob são falsos; a validação do arquivo usa o ffprobe de verdade.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";
import { makeSolidMp4 } from "../helpers/ai-video-media";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));
const blobHead = vi.fn();
const blobDel = vi.fn();
vi.mock("@vercel/blob", () => ({ head: (...a: unknown[]) => blobHead(...a), del: (...a: unknown[]) => blobDel(...a), put: vi.fn() }));

const service = await import("@/lib/youtube-import/backend/import-service");
const { serializeYoutubeImport } = await import("@/lib/youtube-import/backend/import-dto");

const ID = "dQw4w9WgXcQ";
const LINK = `https://youtu.be/${ID}?si=abc`;
const NOW = new Date("2026-10-18T15:00:00.000Z");
const BLOB = "https://abc.public.blob.vercel-storage.com/";
const MP4 = makeSolidMp4({ width: 360, height: 640, seconds: 2 });

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const publicVideo = (duration = "PT2S") =>
  json(200, {
    items: [
      {
        id: ID,
        snippet: { title: "Vídeo do canal", channelTitle: "Canal", liveBroadcastContent: "none", thumbnails: { high: { url: `https://i.ytimg.com/vi/${ID}/hqdefault.jpg` } } },
        contentDetails: { duration },
        status: { uploadStatus: "processed", privacyStatus: "public", embeddable: true, madeForKids: false },
      },
    ],
  });

let apiFetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const api = () => ({ apiKey: "chave-teste", fetchImpl: apiFetch });

async function seedUser(suffix = "1", options: { paid?: boolean } = {}) {
  const [user] = await db.sql`insert into users (email) values (${`yt${suffix}@example.com`}) returning id`;
  if (options.paid) {
    await db.sql`
      insert into automation_subscriptions (user_id, status, plan_code, current_period_ends_at)
      values (${user.id}, 'ACTIVE', 'AUTOMATION', now() + interval '30 days')
    `;
  }
  return user.id as string;
}

async function analyze(userId: string, overrides: Record<string, unknown> = {}, access: { isAdmin?: boolean } = {}, now = NOW) {
  return service.analyzeYoutubeLink(userId, { url: LINK, authorized: true, ...overrides }, now, { ...access, api: api() });
}

function uploadUrl(userId: string, importId: string, name = "original-x1.mp4") {
  return `${BLOB}videos/imports/${userId}/youtube/${importId}/${name}`;
}

function blobAt(url: string, size = MP4.length, contentType = "video/mp4") {
  blobHead.mockResolvedValue({ size, contentType, pathname: new URL(url).pathname.slice(1) });
}

const fileFetch = (buffer: Buffer = MP4) => vi.fn(async () => new Response(new Uint8Array(buffer), { status: 200 }));

beforeEach(async () => {
  db = await createTestDb();
  service.__clearYoutubeMetadataCacheForTests();
  apiFetch = vi.fn(async () => publicVideo());
  blobHead.mockReset();
  blobDel.mockReset().mockResolvedValue(undefined);
  delete process.env.YOUTUBE_IMPORT_MAX_ANALYSES_PER_DAY;
  delete process.env.YOUTUBE_IMPORT_MAX_ANALYSES_PER_MINUTE;
  delete process.env.YOUTUBE_IMPORT_REQUIRES_PAID_PLAN;
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await db.close();
});

describe("analisar o link", () => {
  it("exige a declaração de autorização e não consulta a API sem ela", async () => {
    const userId = await seedUser();
    await expect(service.analyzeYoutubeLink(userId, { url: LINK, authorized: false }, NOW, { api: api() })).rejects.toMatchObject({
      code: "AUTHORIZATION_REQUIRED",
      httpStatus: 400,
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("link inválido: 400, sem registro e sem chamada externa", async () => {
    const userId = await seedUser();
    await expect(analyze(userId, { url: "https://evil.com/watch?v=dQw4w9WgXcQ" })).rejects.toMatchObject({ code: "INVALID_URL", httpStatus: 400 });
    await expect(analyze(userId, { url: "https://www.youtube.com/@canal" })).rejects.toMatchObject({ code: "UNSUPPORTED" });
    expect(apiFetch).not.toHaveBeenCalled();
    const [{ total }] = await db.sql`select count(*)::int as total from youtube_video_imports`;
    expect(total).toBe(0);
  });

  it("vídeo público: registra ANALYZED com metadados e devolve DTO sem dados internos", async () => {
    const userId = await seedUser();
    const { record } = await analyze(userId);
    expect(record).toMatchObject({ status: "ANALYZED", videoId: ID, urlKind: "video", availability: "AVAILABLE", title: "Vídeo do canal", youtubeDurationSeconds: 2 });
    const dto = serializeYoutubeImport(record!);
    expect(dto).not.toHaveProperty("userId");
    expect(dto).not.toHaveProperty("storagePath");
    expect(dto.normalizedUrl).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(dto.warningMessage).toBeNull();
  });

  it("Short: guarda o tipo short", async () => {
    const userId = await seedUser();
    const { record } = await analyze(userId, { url: `https://www.youtube.com/shorts/${ID}` });
    expect(record?.urlKind).toBe("short");
  });

  it("privado e inexistente: registro com disponibilidade (upload continua possível)", async () => {
    const userId = await seedUser();
    apiFetch = vi.fn(async (url: string) => (url.includes("googleapis") ? json(200, { items: [] }) : new Response("", { status: 401 })));
    expect((await analyze(userId)).record?.availability).toBe("PRIVATE");
    service.__clearYoutubeMetadataCacheForTests();
    apiFetch = vi.fn(async (url: string) => (url.includes("googleapis") ? json(200, { items: [] }) : new Response("", { status: 404 })));
    expect((await analyze(userId)).record?.availability).toBe("NOT_FOUND");
  });

  it.each([
    ["QUOTA_EXCEEDED", json(403, { error: { errors: [{ reason: "quotaExceeded" }] } }), /cota/i],
    ["API_AUTH_FAILED", json(400, { error: { message: "API key not valid", errors: [{ reason: "keyInvalid" }] } }), /configurada/i],
    ["CONNECTION", new Response("", { status: 503 }), /conexão/i],
  ])("erro da API (%s): registro UNKNOWN com aviso claro, sem fingir sucesso", async (code, response, message) => {
    const userId = await seedUser();
    apiFetch = vi.fn(async () => response.clone());
    const { record } = await analyze(userId);
    expect(record).toMatchObject({ availability: "UNKNOWN", metadataSource: "none", errorCode: code, title: null, fileUrl: null, status: "ANALYZED" });
    expect(serializeYoutubeImport(record!).warningMessage).toMatch(message);
  });

  it("sem YOUTUBE_API_KEY: usa oEmbed e avisa que a consulta é básica", async () => {
    const userId = await seedUser();
    const oembed = vi.fn(async () => json(200, { title: "Básico", author_name: "Canal", thumbnail_url: `https://i.ytimg.com/vi/${ID}/hqdefault.jpg` }));
    const { record } = await service.analyzeYoutubeLink(userId, { url: LINK, authorized: true }, NOW, { api: { apiKey: "", fetchImpl: oembed } });
    expect(record).toMatchObject({ metadataSource: "oembed", title: "Básico", youtubeDurationSeconds: null });
    expect(serializeYoutubeImport(record!).warningMessage).toMatch(/básicos/);
  });

  it("cache curto: o mesmo vídeo não gasta cota de novo", async () => {
    const userId = await seedUser();
    await analyze(userId);
    await analyze(userId, {}, {}, new Date(NOW.getTime() + 1000));
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("limite por minuto (429 RATE_LIMITED)", async () => {
    process.env.YOUTUBE_IMPORT_MAX_ANALYSES_PER_MINUTE = "2";
    const userId = await seedUser();
    await analyze(userId);
    await analyze(userId);
    await expect(analyze(userId)).rejects.toMatchObject({ code: "RATE_LIMITED", httpStatus: 429 });
  });

  it("limite diário (429 DAILY_LIMIT); administrador não tem limite diário", async () => {
    process.env.YOUTUBE_IMPORT_MAX_ANALYSES_PER_DAY = "2";
    const userId = await seedUser();
    await analyze(userId, {}, {}, new Date(NOW.getTime() - 3 * 60_000));
    await analyze(userId, {}, {}, new Date(NOW.getTime() - 2 * 60_000));
    await expect(analyze(userId)).rejects.toMatchObject({ code: "DAILY_LIMIT", httpStatus: 429 });
    await expect(analyze(userId, {}, { isAdmin: true })).resolves.toMatchObject({ duplicate: null });
    // A tentativa recusada também conta (registra antes de checar).
    expect((await service.getYoutubeImportQuota(userId, false, NOW)).used).toBe(4);
  });

  it("excluir importações não devolve cota", async () => {
    process.env.YOUTUBE_IMPORT_MAX_ANALYSES_PER_DAY = "1";
    const userId = await seedUser();
    const { record } = await analyze(userId, {}, {}, new Date(NOW.getTime() - 5 * 60_000));
    expect(await service.deleteYoutubeImportWithFile(userId, record!.id, blobDel)).toBe(true);
    await expect(analyze(userId)).rejects.toMatchObject({ code: "DAILY_LIMIT" });
  });

  it("o dia do limite é o de São Paulo (UTC−3)", () => {
    expect(service.startOfSaoPauloDay(new Date("2026-10-18T02:00:00.000Z")).toISOString()).toBe("2026-10-17T03:00:00.000Z");
    expect(service.startOfSaoPauloDay(new Date("2026-10-18T03:00:00.000Z")).toISOString()).toBe("2026-10-18T03:00:00.000Z");
    expect(service.startOfSaoPauloDay(new Date("2026-10-18T23:59:00.000Z")).toISOString()).toBe("2026-10-18T03:00:00.000Z");
  });

  it("plano pago opcional (YOUTUBE_IMPORT_REQUIRES_PAID_PLAN=true)", async () => {
    process.env.YOUTUBE_IMPORT_REQUIRES_PAID_PLAN = "true";
    const free = await seedUser("free");
    await expect(analyze(free)).rejects.toMatchObject({ code: "PLAN_REQUIRED", httpStatus: 402 });
    const paid = await seedUser("paid", { paid: true });
    await expect(analyze(paid)).resolves.toBeTruthy();
    await expect(analyze(free, {}, { isAdmin: true })).resolves.toBeTruthy();
  });
});

describe("enviar o arquivo original", () => {
  async function analyzed() {
    const userId = await seedUser();
    const { record } = await analyze(userId);
    return { userId, importId: record!.id };
  }

  it("upload válido: confere no Blob, valida com ffprobe e só então fica COMPLETED", async () => {
    const { userId, importId } = await analyzed();
    const url = uploadUrl(userId, importId);
    blobAt(url);
    const record = await service.registerYoutubeUpload(userId, importId, { blobUrl: url, authorized: true }, NOW, { fetchImpl: fileFetch() });
    expect(record).toMatchObject({ status: "COMPLETED", fileUrl: url, contentType: "video/mp4", width: 360, height: 640, durationMismatch: false });
    expect(record.durationSeconds).toBeGreaterThan(1.5);
    expect(blobDel).not.toHaveBeenCalled();
    // Duplicidade: o mesmo vídeo agora é oferecido como "abrir existente".
    const again = await analyze(userId);
    expect(again.duplicate?.id).toBe(importId);
    // Repetir o registro do mesmo arquivo é idempotente.
    await expect(service.registerYoutubeUpload(userId, importId, { blobUrl: url, authorized: true }, NOW)).resolves.toMatchObject({ status: "COMPLETED" });
  });

  it("guarda a URL canônica devolvida pelo Blob (a mesma que a limpeza compara)", async () => {
    const { userId, importId } = await analyzed();
    const url = uploadUrl(userId, importId, "original-x1.mp4");
    const encoded = url.replace("original-x1", "original%2Dx1");
    blobHead.mockResolvedValue({ size: MP4.length, contentType: "video/mp4", pathname: new URL(url).pathname.slice(1), url });
    const record = await service.registerYoutubeUpload(userId, importId, { blobUrl: encoded, authorized: true }, NOW, { fetchImpl: fileFetch() });
    expect(record.fileUrl).toBe(url);
  });

  it("arquivo com duração muito diferente do YouTube: aceita, mas sinaliza", async () => {
    const userId = await seedUser();
    apiFetch = vi.fn(async () => publicVideo("PT10M"));
    const { record } = await analyze(userId);
    const url = uploadUrl(userId, record!.id);
    blobAt(url);
    const done = await service.registerYoutubeUpload(userId, record!.id, { blobUrl: url, authorized: true }, NOW, { fetchImpl: fileFetch() });
    expect(done.durationMismatch).toBe(true);
  });

  it("upload inválido (não é vídeo): recusa e apaga o arquivo enviado", async () => {
    const { userId, importId } = await analyzed();
    const url = uploadUrl(userId, importId);
    blobAt(url, 4096);
    await expect(
      service.registerYoutubeUpload(userId, importId, { blobUrl: url, authorized: true }, NOW, { fetchImpl: fileFetch(Buffer.alloc(4096, 7)) }),
    ).rejects.toMatchObject({ code: "INVALID_FILE", httpStatus: 422 });
    expect(blobDel).toHaveBeenCalledWith(url);
    const [row] = await db.sql`select status, file_url from youtube_video_imports where id = ${importId}`;
    expect(row).toEqual({ status: "ANALYZED", file_url: null });
  });

  it("tipo de arquivo não permitido: 415 e apaga", async () => {
    const { userId, importId } = await analyzed();
    const url = uploadUrl(userId, importId);
    blobAt(url, 1000, "image/png");
    await expect(service.registerYoutubeUpload(userId, importId, { blobUrl: url, authorized: true }, NOW, { fetchImpl: fileFetch() })).rejects.toMatchObject({
      code: "INVALID_FILE",
      httpStatus: 415,
    });
    expect(blobDel).toHaveBeenCalledWith(url);
  });

  it("arquivo muito grande: recusa pelo tamanho real no Blob, sem baixar", async () => {
    const { userId, importId } = await analyzed();
    const url = uploadUrl(userId, importId);
    blobAt(url, 101 * 1024 * 1024);
    const fetchImpl = fileFetch();
    await expect(service.registerYoutubeUpload(userId, importId, { blobUrl: url, authorized: true }, NOW, { fetchImpl })).rejects.toMatchObject({
      code: "TOO_LARGE",
      httpStatus: 413,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(blobDel).toHaveBeenCalledWith(url);
  });

  it("vídeo longo demais (limite de duração do admin): recusa", async () => {
    const { userId, importId } = await analyzed();
    await db.sql`update instagram_import_settings set max_imported_duration_minutes = 0`;
    const url = uploadUrl(userId, importId);
    blobAt(url);
    await expect(service.registerYoutubeUpload(userId, importId, { blobUrl: url, authorized: true }, NOW, { fetchImpl: fileFetch() })).rejects.toMatchObject({
      code: "TOO_LONG",
    });
  });

  it("falha de armazenamento ao ler o arquivo: erro claro e nada de COMPLETED", async () => {
    const { userId, importId } = await analyzed();
    const url = uploadUrl(userId, importId);
    blobAt(url);
    await expect(
      service.registerYoutubeUpload(userId, importId, { blobUrl: url, authorized: true }, NOW, { fetchImpl: vi.fn(async () => new Response("", { status: 503 })) }),
    ).rejects.toMatchObject({ code: "STORAGE_FAILED", httpStatus: 502 });
    const [row] = await db.sql`select status from youtube_video_imports where id = ${importId}`;
    expect(row.status).toBe("ANALYZED");
  });

  it("blob que não existe no store da Alilu (head falha): recusa sem baixar", async () => {
    const { userId, importId } = await analyzed();
    blobHead.mockRejectedValue(new Error("BlobNotFoundError"));
    const fetchImpl = fileFetch();
    await expect(
      service.registerYoutubeUpload(userId, importId, { blobUrl: uploadUrl(userId, importId), authorized: true }, NOW, { fetchImpl }),
    ).rejects.toMatchObject({ code: "UPLOAD_NOT_FOUND" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["outro domínio", (u: string, i: string) => `https://evil.com/videos/imports/${u}/youtube/${i}/a.mp4`],
    ["http", (u: string, i: string) => `http://abc.public.blob.vercel-storage.com/videos/imports/${u}/youtube/${i}/a.mp4`],
    ["pasta do Instagram", (u: string) => `${BLOB}videos/imports/${u}/manual/a.mp4`],
    ["outra importação", (u: string) => `${BLOB}videos/imports/${u}/youtube/00000000-0000-4000-8000-000000000000/a.mp4`],
    ["path traversal", (u: string, i: string) => `${BLOB}videos/imports/${u}/youtube/${i}/../../x.mp4`],
    ["metadados da nuvem", () => "http://169.254.169.254/latest/meta-data"],
    ["com query string", (u: string, i: string) => `${BLOB}videos/imports/${u}/youtube/${i}/a.mp4?download=1`],
    ["com fragmento", (u: string, i: string) => `${BLOB}videos/imports/${u}/youtube/${i}/a.mp4#x`],
  ])("URL não autorizada (%s): 400, sem nenhum acesso externo", async (_label, build) => {
    const { userId, importId } = await analyzed();
    const fetchImpl = fileFetch();
    await expect(service.registerYoutubeUpload(userId, importId, { blobUrl: build(userId, importId), authorized: true }, NOW, { fetchImpl })).rejects.toMatchObject({
      code: "INVALID_UPLOAD",
    });
    expect(blobHead).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("usuário não pode usar nem ver a importação de outro usuário", async () => {
    const { userId, importId } = await analyzed();
    const intruder = await seedUser("2");
    // Mesmo apontando para a pasta do dono, o intruso não passa.
    await expect(
      service.registerYoutubeUpload(intruder, importId, { blobUrl: uploadUrl(userId, importId), authorized: true }, NOW),
    ).rejects.toMatchObject({ code: "NOT_FOUND", httpStatus: 404 });
    await expect(service.assertImportAcceptsUpload(intruder, importId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(service.parseYoutubeUploadPathname(`videos/imports/${userId}/youtube/${importId}/a.mp4`, intruder)).toBeNull();
    expect(await service.deleteYoutubeImportWithFile(intruder, importId, blobDel)).toBe(false);
  });

  it("exige a declaração também no envio", async () => {
    const { userId, importId } = await analyzed();
    await expect(service.registerYoutubeUpload(userId, importId, { blobUrl: uploadUrl(userId, importId), authorized: false }, NOW)).rejects.toMatchObject({
      code: "AUTHORIZATION_REQUIRED",
    });
  });

  it("dois envios simultâneos: só o primeiro vale, o segundo arquivo é descartado", async () => {
    const { userId, importId } = await analyzed();
    const first = uploadUrl(userId, importId, "a.mp4");
    const second = uploadUrl(userId, importId, "b.mp4");
    blobHead.mockImplementation(async (url: string) => ({ size: MP4.length, contentType: "video/mp4", pathname: new URL(url).pathname.slice(1) }));
    const results = await Promise.allSettled([
      service.registerYoutubeUpload(userId, importId, { blobUrl: first, authorized: true }, NOW, { fetchImpl: fileFetch() }),
      service.registerYoutubeUpload(userId, importId, { blobUrl: second, authorized: true }, NOW, { fetchImpl: fileFetch() }),
    ]);
    const [row] = await db.sql`select status, file_url from youtube_video_imports where id = ${importId}`;
    expect(row.status).toBe("COMPLETED");
    const loser = row.file_url === first ? second : first;
    expect(blobDel).toHaveBeenCalledWith(loser);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
  });

  it("token de upload só para importação ainda sem arquivo, do próprio usuário", async () => {
    const { userId, importId } = await analyzed();
    expect(service.parseYoutubeUploadPathname(`videos/imports/${userId}/youtube/${importId}/original.mp4`, userId)).toEqual({ importId });
    expect(service.parseYoutubeUploadPathname(`videos/imports/${userId}/youtube/${importId}/sub/original.mp4`, userId)).toBeNull();
    expect(service.parseYoutubeUploadPathname(`videos/imports/${userId}/youtube/nao-uuid/original.mp4`, userId)).toBeNull();
    await expect(service.assertImportAcceptsUpload(userId, importId)).resolves.toMatchObject({ id: importId });
    const url = uploadUrl(userId, importId);
    blobAt(url);
    await service.registerYoutubeUpload(userId, importId, { blobUrl: url, authorized: true }, NOW, { fetchImpl: fileFetch() });
    await expect(service.assertImportAcceptsUpload(userId, importId)).rejects.toMatchObject({ code: "ALREADY_COMPLETED", httpStatus: 409 });
  });

  it("excluir apaga o registro e o arquivo", async () => {
    const { userId, importId } = await analyzed();
    const url = uploadUrl(userId, importId);
    blobAt(url);
    await service.registerYoutubeUpload(userId, importId, { blobUrl: url, authorized: true }, NOW, { fetchImpl: fileFetch() });
    expect(await service.deleteYoutubeImportWithFile(userId, importId, blobDel)).toBe(true);
    expect(blobDel).toHaveBeenCalledWith(url);
    const [{ total }] = await db.sql`select count(*)::int as total from youtube_video_imports`;
    expect(total).toBe(0);
  });
});
