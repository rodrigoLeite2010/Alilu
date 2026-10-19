// Limpeza automática x Importar do YouTube: arquivos enviados vencidos/órfãos e o
// prazo de 30 dias dos metadados da API (Developer Policies III.E.4).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "../helpers/pglite-db";

let db: TestDb;
vi.mock("@/lib/db/client", () => ({ getDb: () => db.sql, assertDatabaseConfigured: () => undefined }));
let store: Array<{ url: string; pathname: string; size: number; uploadedAt: Date }> = [];
const deleted: string[] = [];
vi.mock("@vercel/blob", () => ({
  list: async ({ prefix }: { prefix: string }) => ({
    blobs: store.filter((blob) => blob.pathname.startsWith(prefix)).map((blob) => ({ ...blob, downloadUrl: blob.url, etag: "x" })),
    hasMore: false,
  }),
  del: async (urls: string | string[]) => {
    for (const url of Array.isArray(urls) ? urls : [urls]) {
      deleted.push(url);
      store = store.filter((blob) => blob.url !== url);
    }
  },
}));

const cleanup = await import("@/lib/storage-cleanup/backend/cleanup-service");
const NOW = new Date("2026-10-18T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);
const BASE = "https://abc.public.blob.vercel-storage.com/";

function addBlob(pathname: string, ageHours: number, size = 1000) {
  const url = `${BASE}${pathname}`;
  store.push({ url, pathname, size, uploadedAt: hoursAgo(ageHours) });
  return url;
}

async function insertImport(userId: string, values: { fileUrl?: string | null; completedHoursAgo?: number; metadataHoursAgo?: number; title?: string }) {
  const [row] = await db.sql`
    insert into youtube_video_imports (user_id, video_id, url_kind, original_url, normalized_url, status, availability, metadata_source, title,
      metadata_fetched_at, file_url, file_size_bytes, authorized_at, completed_at)
    values (${userId}, 'dQw4w9WgXcQ', 'video', 'u', 'u', ${values.fileUrl ? "COMPLETED" : "ANALYZED"}, 'AVAILABLE', 'data_api', ${values.title ?? "Título"},
      ${hoursAgo(values.metadataHoursAgo ?? 1).toISOString()}, ${values.fileUrl ?? null}, 5000, now(),
      ${values.fileUrl ? hoursAgo(values.completedHoursAgo ?? 1).toISOString() : null})
    returning id
  `;
  return row.id as string;
}

beforeEach(async () => {
  db = await createTestDb();
  store = [];
  deleted.length = 0;
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await db.close();
});

describe("limpeza do storage — YouTube", () => {
  it("apaga arquivos enviados vencidos e órfãos, preserva os recentes e registrados", async () => {
    const [user] = await db.sql`insert into users (email) values ('yt-clean@example.com') returning id`;
    const userId = user.id as string;
    await db.sql`update storage_cleanup_settings set dry_run = false`;
    const old = addBlob(`videos/imports/${userId}/youtube/a/original.mp4`, 24 * 10);
    const oldId = await insertImport(userId, { fileUrl: old, completedHoursAgo: 24 * 10 });
    const recent = addBlob(`videos/imports/${userId}/youtube/b/original.mp4`, 24 * 2);
    await insertImport(userId, { fileUrl: recent, completedHoursAgo: 24 * 2 });
    const orphan = addBlob(`videos/imports/${userId}/youtube/c/original.mp4`, 30);
    const uploadingNow = addBlob(`videos/imports/${userId}/youtube/d/original.mp4`, 1);

    const { report } = await cleanup.runStorageCleanup({ trigger: "CRON", now: NOW });
    expect(new Set(deleted)).toEqual(new Set([old, orphan]));
    expect(store.map((blob) => blob.url).sort()).toEqual([recent, uploadingNow].sort());
    expect(report.rules.youtube_imports_expired).toMatchObject({ deleted: 1, bytes: 5000 });
    const [row] = await db.sql`select status, file_url from youtube_video_imports where id = ${oldId}`;
    expect(row).toEqual({ status: "EXPIRED", file_url: null });
  });

  it("em simulação não apaga arquivos, mas sempre remove metadados com mais de 30 dias", async () => {
    const [user] = await db.sql`insert into users (email) values ('yt-meta@example.com') returning id`;
    const fresh = await insertImport(user.id as string, { metadataHoursAgo: 24 * 29, title: "recente" });
    const stale = await insertImport(user.id as string, { metadataHoursAgo: 24 * 31, title: "antigo" });
    const file = addBlob(`videos/imports/${user.id}/youtube/x/original.mp4`, 24 * 30);
    const { report } = await cleanup.runStorageCleanup({ trigger: "ADMIN", now: NOW });
    expect(report.dryRun).toBe(true);
    expect(deleted).toEqual([]);
    expect(store.some((blob) => blob.url === file)).toBe(true);
    const rows = await db.sql`select id, title, metadata_source from youtube_video_imports order by created_at`;
    expect(rows.find((r) => r.id === fresh)).toMatchObject({ title: "recente", metadata_source: "data_api" });
    expect(rows.find((r) => r.id === stale)).toMatchObject({ title: null, metadata_source: "none" });
  });

  it("o prazo de 30 dias dos metadados vale mesmo com a limpeza desligada", async () => {
    const [user] = await db.sql`insert into users (email) values ('yt-off@example.com') returning id`;
    const stale = await insertImport(user.id as string, { metadataHoursAgo: 24 * 40 });
    await db.sql`update storage_cleanup_settings set enabled = false`;
    const result = await cleanup.runStorageCleanup({ trigger: "CRON", now: NOW });
    expect(result.skipped).toBe(true);
    const [row] = await db.sql`select title, availability, embeddable, metadata_fetched_at from youtube_video_imports where id = ${stale}`;
    expect(row).toEqual({ title: null, availability: "UNKNOWN", embeddable: false, metadata_fetched_at: null });
  });
});
