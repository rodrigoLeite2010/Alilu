// @vitest-environment node
//
// Testa GET/PUT/DELETE de /api/instagram/account/music mockando `auth` e
// o repositório — sem nenhuma chamada real de rede ou de banco. Mesmo
// padrão de instagram-posts-id-route.test.ts.
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const getInstagramAccountForUserMock = vi.fn();
const updateInstagramAccountDefaultMusicMock = vi.fn();
const removeInstagramAccountDefaultMusicMock = vi.fn();
vi.mock("@/lib/instagram/backend/instagram-account-repository", () => ({
  getInstagramAccountForUser: (...args: unknown[]) => getInstagramAccountForUserMock(...args),
  updateInstagramAccountDefaultMusic: (...args: unknown[]) => updateInstagramAccountDefaultMusicMock(...args),
  removeInstagramAccountDefaultMusic: (...args: unknown[]) => removeInstagramAccountDefaultMusicMock(...args),
}));

const { GET, PUT, DELETE } = await import("@/app/api/instagram/account/music/route");

const NO_MUSIC = {
  enabled: false,
  type: "None" as const,
  name: null,
  artist: null,
  externalId: null,
  url: null,
  audioFileUrl: null,
  audioFileName: null,
};

const ACCOUNT = {
  id: "account-1",
  userId: "user-1",
  igUserId: "178414000",
  igUsername: "alilu.tec",
  tokenExpiresAt: null,
  scopes: null,
  status: "connected" as const,
  connectedAt: new Date(),
  updatedAt: new Date(),
  defaultMusic: NO_MUSIC,
};

function putRequest(body: unknown): Request {
  return new Request("https://alilu.com.br/api/instagram/account/music", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authMock.mockReset();
  getInstagramAccountForUserMock.mockReset();
  updateInstagramAccountDefaultMusicMock.mockReset();
  removeInstagramAccountDefaultMusicMock.mockReset();
});

describe("GET /api/instagram/account/music", () => {
  it("responde 401 sem sessão", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(getInstagramAccountForUserMock).not.toHaveBeenCalled();
  });

  it("responde 404 quando não há conta conectada", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountForUserMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(404);
  });

  it("devolve a música padrão da conta conectada", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountForUserMock.mockResolvedValue({
      ...ACCOUNT,
      defaultMusic: { ...NO_MUSIC, enabled: true, type: "InstagramCatalog", name: "Beautiful Day", artist: "U2" },
    });

    const response = await GET();
    const body = (await response.json()) as { defaultMusic: typeof NO_MUSIC };

    expect(response.status).toBe(200);
    expect(body.defaultMusic).toMatchObject({ enabled: true, name: "Beautiful Day", artist: "U2" });
  });
});

describe("PUT /api/instagram/account/music", () => {
  it("responde 401 sem sessão", async () => {
    authMock.mockResolvedValue(null);

    const response = await PUT(putRequest({ enabled: true, type: "InstagramCatalog" }));

    expect(response.status).toBe(401);
    expect(updateInstagramAccountDefaultMusicMock).not.toHaveBeenCalled();
  });

  it("responde 404 quando não há conta conectada", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountForUserMock.mockResolvedValue(null);

    const response = await PUT(putRequest({ enabled: true, type: "InstagramCatalog" }));

    expect(response.status).toBe(404);
  });

  it("responde 400 quando 'enabled' não é booleano", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountForUserMock.mockResolvedValue(ACCOUNT);

    const response = await PUT(putRequest({ enabled: "sim", type: "InstagramCatalog" }));

    expect(response.status).toBe(400);
    expect(updateInstagramAccountDefaultMusicMock).not.toHaveBeenCalled();
  });

  it("responde 400 quando 'type' é inválido", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountForUserMock.mockResolvedValue(ACCOUNT);

    const response = await PUT(putRequest({ enabled: true, type: "SpotifyTrack" }));

    expect(response.status).toBe(400);
    expect(updateInstagramAccountDefaultMusicMock).not.toHaveBeenCalled();
  });

  it("responde 400 quando um campo de texto excede o limite", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountForUserMock.mockResolvedValue(ACCOUNT);

    const response = await PUT(
      putRequest({ enabled: true, type: "InstagramCatalog", name: "x".repeat(201) }),
    );

    expect(response.status).toBe(400);
    expect(updateInstagramAccountDefaultMusicMock).not.toHaveBeenCalled();
  });

  it("salva a música padrão da conta e devolve o resultado atualizado", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountForUserMock.mockResolvedValue(ACCOUNT);
    updateInstagramAccountDefaultMusicMock.mockResolvedValue({
      ...ACCOUNT,
      defaultMusic: { ...NO_MUSIC, enabled: true, type: "InstagramCatalog", name: "Beautiful Day", artist: "U2" },
    });

    const response = await PUT(
      putRequest({ enabled: true, type: "InstagramCatalog", name: "Beautiful Day", artist: "U2" }),
    );
    const body = (await response.json()) as { defaultMusic: typeof NO_MUSIC };

    expect(response.status).toBe(200);
    expect(body.defaultMusic).toMatchObject({ enabled: true, name: "Beautiful Day", artist: "U2" });
    expect(updateInstagramAccountDefaultMusicMock).toHaveBeenCalledWith("account-1", "user-1", {
      enabled: true,
      type: "InstagramCatalog",
      name: "Beautiful Day",
      artist: "U2",
      externalId: null,
      url: null,
      audioFileUrl: null,
      audioFileName: null,
    });
  });

  it("salva uma trilha própria (CustomAudio)", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountForUserMock.mockResolvedValue(ACCOUNT);
    updateInstagramAccountDefaultMusicMock.mockResolvedValue({
      ...ACCOUNT,
      defaultMusic: {
        ...NO_MUSIC,
        enabled: true,
        type: "CustomAudio",
        audioFileUrl: "https://blob.example.com/trilha.mp3",
        audioFileName: "trilha.mp3",
      },
    });

    const response = await PUT(
      putRequest({
        enabled: true,
        type: "CustomAudio",
        audioFileUrl: "https://blob.example.com/trilha.mp3",
        audioFileName: "trilha.mp3",
      }),
    );

    expect(response.status).toBe(200);
    expect(updateInstagramAccountDefaultMusicMock).toHaveBeenCalledWith("account-1", "user-1", {
      enabled: true,
      type: "CustomAudio",
      name: null,
      artist: null,
      externalId: null,
      url: null,
      audioFileUrl: "https://blob.example.com/trilha.mp3",
      audioFileName: "trilha.mp3",
    });
  });
});

describe("DELETE /api/instagram/account/music — \"Remover música padrão\"", () => {
  it("responde 401 sem sessão", async () => {
    authMock.mockResolvedValue(null);

    const response = await DELETE();

    expect(response.status).toBe(401);
    expect(removeInstagramAccountDefaultMusicMock).not.toHaveBeenCalled();
  });

  it("responde 404 quando não há conta conectada", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountForUserMock.mockResolvedValue(null);

    const response = await DELETE();

    expect(response.status).toBe(404);
  });

  it("remove a música padrão e devolve a conta sem música", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    getInstagramAccountForUserMock.mockResolvedValue({
      ...ACCOUNT,
      defaultMusic: { ...NO_MUSIC, enabled: true, type: "InstagramCatalog", name: "Beautiful Day" },
    });
    removeInstagramAccountDefaultMusicMock.mockResolvedValue(ACCOUNT);

    const response = await DELETE();
    const body = (await response.json()) as { defaultMusic: typeof NO_MUSIC };

    expect(response.status).toBe(200);
    expect(body.defaultMusic).toEqual(NO_MUSIC);
    expect(removeInstagramAccountDefaultMusicMock).toHaveBeenCalledWith("account-1", "user-1");
  });
});
