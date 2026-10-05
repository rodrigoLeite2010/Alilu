// @vitest-environment node
//
// "Repostar carrossel": valida dono/estado/ordem da importação e cria o post
// de carrossel com cópias dos arquivos na biblioteca (Blob e banco simulados).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeImportError extends Error {
  constructor(message: string, public code: string, public status: number) {
    super(message);
  }
}

const copyMock = vi.fn();
const delMock = vi.fn();
const getImportForUserMock = vi.fn();
const insertInstagramMediaMock = vi.fn();
const createCarouselPostMock = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({ copy: (...a: unknown[]) => copyMock(...a), del: (...a: unknown[]) => delMock(...a) }));
vi.mock("@/lib/instagram/backend/media-service", () => ({ buildMediaPathnamePrefix: (u: string) => `instagram-media/${u}/` }));
vi.mock("@/lib/instagram/backend/media-repository", () => ({ insertInstagramMedia: (...a: unknown[]) => insertInstagramMediaMock(...a) }));
vi.mock("@/lib/instagram/backend/instagram-post-service", () => ({ createCarouselPost: (...a: unknown[]) => createCarouselPostMock(...a) }));
vi.mock("@/lib/instagram-import/backend/import-repository", () => ({ getImportForUser: (...a: unknown[]) => getImportForUserMock(...a) }));
vi.mock("@/lib/instagram-import/backend/import-service", () => ({ InstagramImportError: FakeImportError, MAX_CAROUSEL_IMPORT_ITEMS: 10 }));

const { createCarouselPostFromImport } = await import("@/lib/instagram-import/backend/repost-service");

const IMPORT_ID = "11111111-2222-3333-4444-555555555555";
function item(index: number, mediaType: "IMAGE" | "VIDEO") {
  return {
    index,
    mediaType,
    fileUrl: `https://blob/imports/${index}.${mediaType === "VIDEO" ? "mp4" : "jpg"}`,
    contentType: mediaType === "VIDEO" ? "video/mp4" : "image/jpeg",
    fileSizeBytes: 1000,
  };
}
function record(overrides: Record<string, unknown> = {}) {
  return { id: IMPORT_ID, status: "COMPLETED", importedItems: [item(0, "IMAGE"), item(1, "VIDEO"), item(2, "IMAGE")], ...overrides };
}

beforeEach(() => {
  let n = 0;
  copyMock.mockImplementation(async () => ({ url: `https://blob/lib/copy-${++n}` }));
  delMock.mockResolvedValue(undefined);
  insertInstagramMediaMock.mockImplementation(async (input: { storageUrl: string }) => `media-${input.storageUrl.slice(-1)}`);
  createCarouselPostMock.mockResolvedValue("post-1");
  getImportForUserMock.mockResolvedValue(record());
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("createCarouselPostFromImport", () => {
  it("importação de outro usuário (ou inexistente) => NOT_FOUND", async () => {
    getImportForUserMock.mockResolvedValue(null);
    await expect(createCarouselPostFromImport("user-2", { importId: IMPORT_ID })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(getImportForUserMock).toHaveBeenCalledWith(IMPORT_ID, "user-2");
    expect(copyMock).not.toHaveBeenCalled();
  });

  it("id inválido nem consulta o banco", async () => {
    await expect(createCarouselPostFromImport("user-1", { importId: "../x" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(getImportForUserMock).not.toHaveBeenCalled();
  });

  it("importação que não é carrossel concluído => NOT_CAROUSEL", async () => {
    getImportForUserMock.mockResolvedValue(record({ importedItems: [item(0, "IMAGE")] }));
    await expect(createCarouselPostFromImport("user-1", { importId: IMPORT_ID })).rejects.toMatchObject({ code: "NOT_CAROUSEL" });
    getImportForUserMock.mockResolvedValue(record({ status: "READY" }));
    await expect(createCarouselPostFromImport("user-1", { importId: IMPORT_ID })).rejects.toMatchObject({ code: "NOT_CAROUSEL" });
  });

  it("rejeita ordem com repetição, com 1 item ou com índice inexistente", async () => {
    for (const order of [[0, 0], [1], [0, 9]]) {
      await expect(createCarouselPostFromImport("user-1", { importId: IMPORT_ID, order })).rejects.toMatchObject({ code: "INVALID_ORDER" });
    }
    expect(createCarouselPostMock).not.toHaveBeenCalled();
  });

  it("copia os itens na ordem escolhida e cria o carrossel (agendado)", async () => {
    const result = await createCarouselPostFromImport("user-1", {
      importId: IMPORT_ID,
      order: [1, 0],
      caption: "Legenda\n\nCréditos: @perfil",
      scheduledAt: "2026-10-10T12:00",
      timezone: "America/Sao_Paulo",
    });

    expect(result).toEqual({ postId: "post-1" });
    expect(copyMock.mock.calls[0][0]).toBe("https://blob/imports/1.mp4");
    expect(copyMock.mock.calls[0][1]).toMatch(/^instagram-media\/user-1\/repost-11111111-1\.mp4$/);
    expect(copyMock.mock.calls[1][0]).toBe("https://blob/imports/0.jpg");
    expect(insertInstagramMediaMock.mock.calls.map((c) => c[0].mediaType)).toEqual(["video", "image"]);
    expect(createCarouselPostMock).toHaveBeenCalledWith({
      userId: "user-1",
      mediaIds: ["media-1", "media-2"],
      caption: "Legenda\n\nCréditos: @perfil",
      scheduledAt: "2026-10-10T12:00",
      timezone: "America/Sao_Paulo",
    });
  });

  it("falha inesperada apaga as cópias já feitas", async () => {
    createCarouselPostMock.mockRejectedValue(new Error("boom"));
    await expect(createCarouselPostFromImport("user-1", { importId: IMPORT_ID })).rejects.toThrow("boom");
    expect(delMock.mock.calls.map((c) => c[0])).toEqual(["https://blob/lib/copy-1", "https://blob/lib/copy-2", "https://blob/lib/copy-3"]);
  });
});
