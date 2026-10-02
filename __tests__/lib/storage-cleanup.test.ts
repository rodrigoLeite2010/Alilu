// Limpeza automática do Vercel Blob contra Postgres real em memória (PGlite)
// e um "Blob" falso em memória (list/del) — o resto é o código de produção.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));

interface FakeBlob {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: Date;
}
let store: FakeBlob[] = [];
const deleted: string[] = [];
vi.mock("@vercel/blob", () => ({
  list: async ({ prefix, cursor, limit }: { prefix: string; cursor?: string; limit: number }) => {
    // Cursor por chave (como no Blob real): apagar no meio da paginação não pula arquivos.
    const all = store.filter((blob) => blob.pathname.startsWith(prefix) && (!cursor || blob.pathname > cursor)).sort((a, b) => a.pathname.localeCompare(b.pathname));
    const page = all.slice(0, Math.min(limit, 2)); // páginas pequenas para testar a paginação
    return { blobs: page.map((blob) => ({ ...blob, downloadUrl: blob.url, etag: "x" })), hasMore: all.length > page.length, cursor: page.at(-1)?.pathname };
  },
  del: async (urls: string | string[]) => {
    for (const url of Array.isArray(urls) ? urls : [urls]) {
      deleted.push(url);
      store = store.filter((blob) => blob.url !== url);
    }
  },
}));

const cleanup = await import("@/lib/storage-cleanup/backend/cleanup-service");
const generations = await import("@/lib/ai-video/backend/generation-repository");

const NOW = new Date("2026-10-10T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);
const BASE = "https://abc.public.blob.vercel-storage.com/";

function addBlob(pathname: string, ageHours: number, size = 1000): string {
  const url = `${BASE}${pathname}`;
  store.push({ url, pathname, size, uploadedAt: hoursAgo(ageHours) });
  return url;
}

async function seedUser(suffix = "1") {
  const [user] = await db.sql`insert into users (email) values (${`clean${suffix}@example.com`}) returning id`;
  return user.id as string;
}

async function seedGeneration(userId: string, overrides: { status?: string; input?: string; storage?: string | null; overlays?: unknown[]; createdHoursAgo?: number }) {
  const [row] = await db.sql`
    insert into ai_video_generations (user_id, idempotency_key, tier, provider, provider_model, prompt, input_image_url, duration_seconds,
      aspect_ratio, resolution, credit_cost, status, provider_estimated_cost_usd, exchange_rate_reference, estimated_cost_brl, revenue_allocated_brl,
      storage_video_url, overlays, created_at)
    values (${userId}, ${`k-${Math.random()}`}, 'PADRAO', 'runway', 'gen4_turbo', 'p', ${overrides.input ?? `${BASE}ai-video/${userId}/input/x.jpg`}, 5,
      '9:16', '720p', 100, ${overrides.status ?? "COMPLETED"}, 0.25, 5.5, 1.8, 4, ${overrides.storage ?? null},
      ${JSON.stringify(overrides.overlays ?? [])}::jsonb, ${hoursAgo(overrides.createdHoursAgo ?? 1).toISOString()})
    returning id
  `;
  return row.id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  store = [];
  deleted.length = 0;
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await db.close();
});

describe("limpeza do storage", () => {
  it("começa em simulação: relata, mas não apaga nada", async () => {
    addBlob("videos/uploads/abandonado.mp4", 48, 5000);
    const result = await cleanup.runStorageCleanup({ trigger: "ADMIN", now: NOW });
    expect(result.report.dryRun).toBe(true);
    expect(result.report.rules.split_uploads).toMatchObject({ scanned: 1, matched: 1, deleted: 1, bytes: 5000 });
    expect(deleted).toEqual([]);
    expect(store).toHaveLength(1);
    const [run] = await db.sql`select dry_run, deleted_files from storage_cleanup_runs`;
    expect(run).toEqual({ dry_run: true, deleted_files: 1 });
  });

  it("apaga temporários e vencidos, preservando tudo que está em uso", async () => {
    const userId = await seedUser();
    await db.sql`update storage_cleanup_settings set dry_run = false`;

    // Split-Screen
    const oldUpload = addBlob("videos/uploads/a.mp4", 30);
    const newUpload = addBlob("videos/uploads/b.mp4", 2);
    const oldOutput = addBlob("videos/outputs/c.mp4", 24 * 4);
    const newOutput = addBlob("videos/outputs/d.mp4", 24);

    // Biblioteca do Instagram
    const media = addBlob(`instagram-media/${userId}/foto.jpg`, 100);
    await db.sql`insert into instagram_media (user_id, storage_url, media_type) values (${userId}, ${media}, 'image')`;
    const audio = addBlob(`instagram-media/${userId}/musica.mp3`, 100);
    await db.sql`insert into instagram_accounts (user_id, ig_user_id, ig_username, access_token_encrypted, default_audio_file_url) values (${userId}, 'ig1', 'conta', 'x', ${audio})`;
    const orphanMedia = addBlob(`instagram-media/${userId}/orfa.jpg`, 100);
    const freshOrphan = addBlob(`instagram-media/${userId}/subindo-agora.jpg`, 1);

    // Vídeo com IA
    const draftInput = addBlob(`ai-video/${userId}/input/rascunho.jpg`, 24 * 60);
    await db.sql`insert into ai_video_drafts (user_id, input_image_url) values (${userId}, ${draftInput})`;
    const activeInput = addBlob(`ai-video/${userId}/input/ativa.jpg`, 24 * 60);
    await seedGeneration(userId, { status: "PROCESSING", input: activeInput, createdHoursAgo: 24 * 60 });
    const logo = addBlob(`ai-video/${userId}/input/logo-marca.png`, 24 * 60);
    await seedGeneration(userId, { status: "COMPLETED", overlays: [{ id: "logo", imageUrl: logo }], createdHoursAgo: 24 });
    const oldInput = addBlob(`ai-video/${userId}/input/velha.jpg`, 24 * 60);
    const generated = addBlob(`ai-video/${userId}/generated/ok.mp4`, 50);
    await seedGeneration(userId, { storage: generated });
    const orphanGenerated = addBlob(`ai-video/${userId}/generated/sobra.mp4`, 50);

    // Importações do Instagram
    const imported = addBlob(`videos/imports/${userId}/i1.mp4`, 24 * 10, 7000);
    await db.sql`
      insert into instagram_media_imports (user_id, original_url, normalized_url, url_kind, status, provider, imported_file_url, file_size_bytes, authorized_at, completed_at)
      values (${userId}, 'u', 'u', 'reel', 'COMPLETED', 'apify', ${imported}, 7000, now(), ${hoursAgo(24 * 10).toISOString()})
    `;
    const recentImport = addBlob(`videos/imports/${userId}/i2.mp4`, 24);
    await db.sql`
      insert into instagram_media_imports (user_id, original_url, normalized_url, url_kind, status, provider, imported_file_url, authorized_at, completed_at)
      values (${userId}, 'u2', 'u2', 'reel', 'COMPLETED', 'apify', ${recentImport}, now(), ${hoursAgo(24).toISOString()})
    `;
    const orphanManual = addBlob(`videos/imports/${userId}/manual/nunca-registrado.mp4`, 30);

    const { report } = await cleanup.runStorageCleanup({ trigger: "CRON", now: NOW });
    expect(report.dryRun).toBe(false);
    expect(new Set(deleted)).toEqual(new Set([oldUpload, oldOutput, orphanMedia, oldInput, orphanGenerated, imported, orphanManual]));
    for (const kept of [newUpload, newOutput, media, audio, freshOrphan, draftInput, activeInput, logo, generated, recentImport]) {
      expect(store.some((blob) => blob.url === kept)).toBe(true);
    }
    const [expiredImport] = await db.sql`select status, imported_file_url from instagram_media_imports where normalized_url = 'u'`;
    expect(expiredImport).toEqual({ status: "EXPIRED", imported_file_url: null });
    expect(report.rules.instagram_imports_expired).toMatchObject({ deleted: 1, bytes: 7000 });
    expect(report.usage["ai-video"].files).toBe(6);
  });

  it("respeita o limite de exclusões por execução e continua na próxima", async () => {
    await db.sql`update storage_cleanup_settings set dry_run = false, max_deletes_per_run = 2`;
    for (let i = 0; i < 5; i += 1) addBlob(`videos/uploads/${i}.mp4`, 48);
    await cleanup.runStorageCleanup({ trigger: "CRON", now: NOW });
    expect(deleted).toHaveLength(2);
    await cleanup.runStorageCleanup({ trigger: "CRON", now: NOW });
    expect(deleted).toHaveLength(4);
  });

  it("desligada: o cron não faz nada; o admin ainda pode simular", async () => {
    await db.sql`update storage_cleanup_settings set enabled = false, dry_run = false`;
    addBlob("videos/uploads/x.mp4", 48);
    expect((await cleanup.runStorageCleanup({ trigger: "CRON", now: NOW })).skipped).toBe(true);
    expect(await db.sql`select id from storage_cleanup_runs`).toHaveLength(0);
    const manual = await cleanup.runStorageCleanup({ trigger: "ADMIN", dryRunOverride: true, now: NOW });
    expect(manual.report.rules.split_uploads.matched).toBe(1);
    expect(deleted).toEqual([]);
  });
});

describe("Excluir vídeo (vídeo com IA)", () => {
  it("apaga só vídeos terminados, do próprio usuário, e tira do histórico", async () => {
    const userId = await seedUser();
    const other = await seedUser("2");
    const done = await seedGeneration(userId, { storage: `${BASE}ai-video/${userId}/generated/v.mp4` });
    const running = await seedGeneration(userId, { status: "PROCESSING" });
    expect(await generations.markGenerationDeletedByUser(running, userId)).toBeNull();
    expect(await generations.markGenerationDeletedByUser(done, other)).toBeNull();
    expect(await generations.markGenerationDeletedByUser(done, userId)).toEqual({ storageVideoUrl: `${BASE}ai-video/${userId}/generated/v.mp4` });
    expect(await generations.markGenerationDeletedByUser(done, userId)).toBeNull();
    const list = await generations.listGenerationsForUser(userId);
    expect(list.map((g) => g.id)).toEqual([running]);
    const [row] = await db.sql`select status, storage_video_url from ai_video_generations where id = ${done}`;
    expect(row).toEqual({ status: "EXPIRED", storage_video_url: null });
  });
});
