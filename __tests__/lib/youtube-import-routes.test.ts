// @vitest-environment node
// Importar do YouTube — rotas: login obrigatório, corpo inválido, token de upload restrito.
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));
vi.mock("@/lib/admin/admin-access", () => ({ isAdminEmail: () => false }));
const analyzeMock = vi.fn();
const registerMock = vi.fn();
const assertMock = vi.fn();
vi.mock("@/lib/youtube-import/backend/import-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/youtube-import/backend/import-service")>("@/lib/youtube-import/backend/import-service");
  return {
    ...actual,
    analyzeYoutubeLink: (...a: unknown[]) => analyzeMock(...a),
    registerYoutubeUpload: (...a: unknown[]) => registerMock(...a),
    assertImportAcceptsUpload: (...a: unknown[]) => assertMock(...a),
    getYoutubeImportQuota: async () => ({ used: 0, limit: 50, unlimited: false }),
    deleteYoutubeImportWithFile: async () => false,
  };
});
vi.mock("@/lib/youtube-import/backend/import-repository", () => ({ getYoutubeImportForUser: async () => null }));
vi.mock("@/lib/instagram-import/backend/import-repository", () => ({
  getImportSettings: async () => ({ maxImportsPerDay: 20, maxImportedVideoSizeMb: 100, maxImportedDurationMinutes: 10, providerCostUsd: 0 }),
}));
const issueSignedTokenMock = vi.fn(async () => "token-assinado");
vi.mock("@vercel/blob", () => ({ issueSignedToken: (...a: unknown[]) => issueSignedTokenMock(...(a as [])), head: vi.fn(), del: vi.fn() }));
const handleUploadPresignedMock = vi.fn();
vi.mock("@vercel/blob/client", () => ({ handleUploadPresigned: (...a: unknown[]) => handleUploadPresignedMock(...a) }));

const analyzeRoute = await import("@/app/api/videos/youtube-import/analyze/route");
const fileRoute = await import("@/app/api/videos/youtube-import/[id]/file/route");
const itemRoute = await import("@/app/api/videos/youtube-import/[id]/route");
const uploadRoute = await import("@/app/api/videos/youtube-import/upload/route");
const { YoutubeImportError } = await import("@/lib/youtube-import/backend/import-service");

const IMPORT_ID = "6f1c2b9e-1111-4222-8333-944455556666";
const params = { params: Promise.resolve({ id: IMPORT_ID }) };
const post = (body: unknown) =>
  new Request("https://alilu.com.br/api/x", { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });

beforeEach(() => {
  authMock.mockReset();
  analyzeMock.mockReset();
  registerMock.mockReset();
  assertMock.mockReset().mockResolvedValue({ id: IMPORT_ID });
  handleUploadPresignedMock.mockReset();
  issueSignedTokenMock.mockClear();
});

describe("usuário não autenticado", () => {
  it("todas as rotas devolvem 401 e nada é executado", async () => {
    authMock.mockResolvedValue(null);
    expect((await analyzeRoute.POST(post({ url: "https://youtu.be/dQw4w9WgXcQ", authorized: true }))).status).toBe(401);
    expect((await fileRoute.POST(post({ blobUrl: "x", authorized: true }), params)).status).toBe(401);
    expect((await itemRoute.GET(new Request("https://alilu.com.br"), params)).status).toBe(401);
    expect((await itemRoute.DELETE(new Request("https://alilu.com.br"), params)).status).toBe(401);
    expect(analyzeMock).not.toHaveBeenCalled();
    expect(registerMock).not.toHaveBeenCalled();
  });
});

describe("usuário autenticado", () => {
  beforeEach(() => authMock.mockResolvedValue({ user: { id: "user-1", email: "u@example.com" } }));

  it("corpo inválido → 400", async () => {
    expect((await analyzeRoute.POST(post("{quebrado"))).status).toBe(400);
    expect((await analyzeRoute.POST(post([1, 2]))).status).toBe(400);
  });

  it("erros de negócio viram status + código; isAdmin nunca vem do corpo", async () => {
    analyzeMock.mockRejectedValue(new YoutubeImportError("Esse link do YouTube não foi reconhecido.", "INVALID_URL", 400));
    const response = await analyzeRoute.POST(post({ url: "x", authorized: true, isAdmin: true }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_URL" });
    expect(analyzeMock.mock.calls[0][3]).toEqual({ isAdmin: false });
  });

  it("erro inesperado → 500 genérico, sem detalhes internos", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    registerMock.mockRejectedValue(new Error("DATABASE_URL=postgres://segredo"));
    const response = await fileRoute.POST(post({ blobUrl: "x", authorized: true }), params);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("segredo");
  });

  it("importação de outro usuário → 404", async () => {
    expect((await itemRoute.GET(new Request("https://alilu.com.br"), params)).status).toBe(404);
  });
});

describe("token de upload direto", () => {
  async function tokenFor(pathname: string) {
    handleUploadPresignedMock.mockImplementation(async ({ getSignedToken }: { getSignedToken: (p: string) => Promise<unknown> }) => getSignedToken(pathname));
    return uploadRoute.POST(post({ type: "blob.generate-presigned-url", payload: { pathname } }));
  }

  it("sem login: recusa", async () => {
    authMock.mockResolvedValue(null);
    expect((await tokenFor(`videos/imports/user-1/youtube/${IMPORT_ID}/original.mp4`)).status).toBe(400);
    expect(issueSignedTokenMock).not.toHaveBeenCalled();
  });

  it("caminho de outro usuário ou fora da pasta: recusa", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    for (const pathname of [
      `videos/imports/user-2/youtube/${IMPORT_ID}/original.mp4`,
      `videos/imports/user-1/manual/original.mp4`,
      `videos/uploads/original.mp4`,
      `videos/imports/user-1/youtube/${IMPORT_ID}/../../x.mp4`,
    ]) {
      expect((await tokenFor(pathname)).status).toBe(400);
    }
    expect(issueSignedTokenMock).not.toHaveBeenCalled();
  });

  it("caminho válido: token travado em tipo e tamanho", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const response = await tokenFor(`videos/imports/user-1/youtube/${IMPORT_ID}/original.mp4`);
    expect(response.status).toBe(200);
    expect(assertMock).toHaveBeenCalledWith("user-1", IMPORT_ID);
    expect(issueSignedTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ operations: ["put"], allowedContentTypes: ["video/mp4", "video/quicktime", "video/webm"], maximumSizeInBytes: 100 * 1024 * 1024 }),
    );
  });

  it("erro inesperado na emissão do token: mensagem genérica, sem detalhe interno", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    assertMock.mockRejectedValue(new Error("connection to postgres://segredo failed"));
    const response = await tokenFor(`videos/imports/user-1/youtube/${IMPORT_ID}/original.mp4`);
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).not.toContain("segredo");
  });

  it("importação que já tem arquivo: recusa", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    assertMock.mockRejectedValue(new YoutubeImportError("já tem arquivo", "ALREADY_COMPLETED", 409));
    expect((await tokenFor(`videos/imports/user-1/youtube/${IMPORT_ID}/original.mp4`)).status).toBe(400);
    expect(issueSignedTokenMock).not.toHaveBeenCalled();
  });
});
