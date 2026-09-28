// @vitest-environment node
//
// Mocka getDb() (retorna uma função de template tag falsa) para testar as
// consultas sem nenhuma conexão de banco real — mesmo padrão de
// instagram-post-repository.test.ts. Cobre só a parte nova ("música
// padrão para publicações"); as funções pré-existentes deste arquivo
// (upsert/getInstagramAccountForUser básicos) não tinham testes antes
// desta funcionalidade e continuam sem — este arquivo não tenta cobri-las
// retroativamente, só a superfície nova.
import { afterEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.fn();
vi.mock("@/lib/db/client", () => ({
  getDb: () => dbMock,
}));

const {
  getInstagramAccountForUser,
  updateInstagramAccountDefaultMusic,
  removeInstagramAccountDefaultMusic,
} = await import("@/lib/instagram/backend/instagram-account-repository");

function fakeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "account-1",
    user_id: "user-1",
    ig_user_id: "178414000",
    ig_username: "alilu.tec",
    token_expires_at: null,
    scopes: null,
    status: "connected",
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    default_music_enabled: false,
    default_music_type: "None",
    default_music_name: null,
    default_music_artist: null,
    default_music_external_id: null,
    default_music_url: null,
    default_audio_file_url: null,
    default_audio_file_name: null,
    ...overrides,
  };
}

afterEach(() => {
  dbMock.mockReset();
});

describe("getInstagramAccountForUser — defaultMusic", () => {
  it("mapeia as colunas de música padrão desabilitada (conta sem música configurada)", async () => {
    dbMock.mockResolvedValueOnce([fakeRow()]);

    const account = await getInstagramAccountForUser("user-1");

    expect(account?.defaultMusic).toEqual({
      enabled: false,
      type: "None",
      name: null,
      artist: null,
      externalId: null,
      url: null,
      audioFileUrl: null,
      audioFileName: null,
    });
  });

  it("mapeia uma música do catálogo do Instagram configurada e ativa", async () => {
    dbMock.mockResolvedValueOnce([
      fakeRow({
        default_music_enabled: true,
        default_music_type: "InstagramCatalog",
        default_music_name: "Beautiful Day",
        default_music_artist: "U2",
        default_music_external_id: "ig-track-123",
        default_music_url: "https://www.instagram.com/reels/audio/123",
      }),
    ]);

    const account = await getInstagramAccountForUser("user-1");

    expect(account?.defaultMusic).toEqual({
      enabled: true,
      type: "InstagramCatalog",
      name: "Beautiful Day",
      artist: "U2",
      externalId: "ig-track-123",
      url: "https://www.instagram.com/reels/audio/123",
      audioFileUrl: null,
      audioFileName: null,
    });
  });

  it("devolve null quando a conta não existe (nunca lança)", async () => {
    dbMock.mockResolvedValueOnce([]);

    const account = await getInstagramAccountForUser("user-sem-conta");

    expect(account).toBeNull();
  });
});

describe("updateInstagramAccountDefaultMusic", () => {
  it("grava a música padrão restrita ao dono da conta (accountId + userId no WHERE)", async () => {
    dbMock.mockResolvedValueOnce([
      fakeRow({
        default_music_enabled: true,
        default_music_type: "InstagramCatalog",
        default_music_name: "Beautiful Day",
        default_music_artist: "U2",
      }),
    ]);

    const updated = await updateInstagramAccountDefaultMusic("account-1", "user-1", {
      enabled: true,
      type: "InstagramCatalog",
      name: "Beautiful Day",
      artist: "U2",
      externalId: null,
      url: null,
      audioFileUrl: null,
      audioFileName: null,
    });

    expect(updated?.defaultMusic.enabled).toBe(true);
    expect(updated?.defaultMusic.name).toBe("Beautiful Day");
    expect(dbMock).toHaveBeenCalledTimes(1);
    const args = dbMock.mock.calls[0].slice(1);
    // enabled, type, name, artist, externalId, url, audioFileUrl, audioFileName, accountId, userId (ordem do template)
    expect(args).toContain(true);
    expect(args).toContain("InstagramCatalog");
    expect(args).toContain("Beautiful Day");
    expect(args).toContain("U2");
    expect(args).toContain("account-1");
    expect(args).toContain("user-1");
  });

  it("grava uma trilha própria (CustomAudio) com URL e nome de arquivo", async () => {
    dbMock.mockResolvedValueOnce([
      fakeRow({
        default_music_enabled: true,
        default_music_type: "CustomAudio",
        default_audio_file_url: "https://blob.example.com/motivacional-alilu.mp3",
        default_audio_file_name: "motivacional-alilu.mp3",
      }),
    ]);

    const updated = await updateInstagramAccountDefaultMusic("account-1", "user-1", {
      enabled: true,
      type: "CustomAudio",
      name: null,
      artist: null,
      externalId: null,
      url: null,
      audioFileUrl: "https://blob.example.com/motivacional-alilu.mp3",
      audioFileName: "motivacional-alilu.mp3",
    });

    expect(updated?.defaultMusic.type).toBe("CustomAudio");
    expect(updated?.defaultMusic.audioFileName).toBe("motivacional-alilu.mp3");
  });

  it("devolve null quando a conta não pertence ao usuário (WHERE não bate com nenhuma linha)", async () => {
    dbMock.mockResolvedValueOnce([]);

    const updated = await updateInstagramAccountDefaultMusic("account-de-outro-usuario", "user-1", {
      enabled: true,
      type: "InstagramCatalog",
      name: "Qualquer",
      artist: null,
      externalId: null,
      url: null,
      audioFileUrl: null,
      audioFileName: null,
    });

    expect(updated).toBeNull();
  });
});

describe("removeInstagramAccountDefaultMusic — botão \"Remover música padrão\"", () => {
  it("volta a conta para o estado sem nenhuma música configurada", async () => {
    dbMock.mockResolvedValueOnce([fakeRow()]); // já sem música após o UPDATE

    const updated = await removeInstagramAccountDefaultMusic("account-1", "user-1");

    expect(updated?.defaultMusic).toEqual({
      enabled: false,
      type: "None",
      name: null,
      artist: null,
      externalId: null,
      url: null,
      audioFileUrl: null,
      audioFileName: null,
    });
    // internamente delega para updateInstagramAccountDefaultMusic com todos os campos nulos/None
    const args = dbMock.mock.calls[0].slice(1);
    expect(args).toContain(false);
    expect(args).toContain("None");
  });
});
