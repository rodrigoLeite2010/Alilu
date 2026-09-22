// @vitest-environment node
//
// Mocka getDb() para testar getInstagramMediaByStorageUrl sem nenhuma
// conexão de banco real. As demais funções de media-repository.ts já são
// exercitadas indiretamente pelo teste da rota de upload
// (instagram-media-upload-route.test.ts).
import { afterEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.fn();
vi.mock("@/lib/db/client", () => ({
  getDb: () => dbMock,
}));

const { getInstagramMediaByStorageUrl } = await import("@/lib/instagram/backend/media-repository");

afterEach(() => {
  dbMock.mockReset();
});

describe("getInstagramMediaByStorageUrl", () => {
  it("retorna null quando não encontra mídia com essa URL para o usuário", async () => {
    dbMock.mockResolvedValueOnce([]);
    const result = await getInstagramMediaByStorageUrl("https://blob/img.jpg", "user-1");
    expect(result).toBeNull();
  });

  it("mapeia a linha encontrada para o formato esperado", async () => {
    dbMock.mockResolvedValueOnce([
      {
        id: "media-1",
        user_id: "user-1",
        storage_url: "https://blob/img.jpg",
        media_type: "image",
        file_size_bytes: 1024,
        original_filename: "foto.jpg",
        created_at: "2026-09-22T00:00:00.000Z",
      },
    ]);

    const result = await getInstagramMediaByStorageUrl("https://blob/img.jpg", "user-1");

    expect(result).toMatchObject({
      id: "media-1",
      userId: "user-1",
      storageUrl: "https://blob/img.jpg",
      mediaType: "image",
      fileSizeBytes: 1024,
      originalFilename: "foto.jpg",
    });
  });
});
