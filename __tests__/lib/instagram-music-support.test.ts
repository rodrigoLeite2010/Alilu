import { describe, expect, it } from "vitest";
import {
  resolveMusicApplication,
  resolveRequestedMusic,
  type AccountDefaultMusic,
  type PostMusicOverride,
} from "@/lib/instagram/backend/music-support";

const NO_ACCOUNT_DEFAULT: AccountDefaultMusic = {
  enabled: false,
  type: "None",
  name: null,
  artist: null,
  externalId: null,
  url: null,
  audioFileUrl: null,
  audioFileName: null,
};

const CATALOG_DEFAULT: AccountDefaultMusic = {
  enabled: true,
  type: "InstagramCatalog",
  name: "Beautiful Day",
  artist: "U2",
  externalId: "123",
  url: null,
  audioFileUrl: null,
  audioFileName: null,
};

describe("resolveRequestedMusic", () => {
  it("musicMode NONE nunca pede música, mesmo com padrão da conta configurado", () => {
    const result = resolveRequestedMusic("NONE", CATALOG_DEFAULT, null);
    expect(result.requestedType).toBe("None");
  });

  it("musicMode ACCOUNT_DEFAULT usa a música da conta quando habilitada", () => {
    const result = resolveRequestedMusic("ACCOUNT_DEFAULT", CATALOG_DEFAULT, null);
    expect(result.requestedType).toBe("InstagramCatalog");
    expect(result.name).toBe("Beautiful Day");
    expect(result.artist).toBe("U2");
  });

  it("musicMode ACCOUNT_DEFAULT sem música configurada na conta resolve para nenhuma música", () => {
    expect(resolveRequestedMusic("ACCOUNT_DEFAULT", NO_ACCOUNT_DEFAULT, null).requestedType).toBe("None");
    expect(resolveRequestedMusic("ACCOUNT_DEFAULT", null, null).requestedType).toBe("None");
  });

  it("musicMode ACCOUNT_DEFAULT com default_music_enabled=false resolve para nenhuma música mesmo com campos preenchidos", () => {
    const disabled: AccountDefaultMusic = { ...CATALOG_DEFAULT, enabled: false };
    expect(resolveRequestedMusic("ACCOUNT_DEFAULT", disabled, null).requestedType).toBe("None");
  });

  it("musicMode CUSTOM usa a escolha do próprio post, ignorando o padrão da conta", () => {
    const override: PostMusicOverride = {
      type: "InstagramCatalog",
      name: "Outra música",
      artist: "Outra banda",
      externalId: null,
      url: null,
      audioFileUrl: null,
      audioFileName: null,
    };
    const result = resolveRequestedMusic("CUSTOM", CATALOG_DEFAULT, override);
    expect(result.name).toBe("Outra música");
  });

  it("musicMode CUSTOM sem override (ou override None) resolve para nenhuma música", () => {
    expect(resolveRequestedMusic("CUSTOM", CATALOG_DEFAULT, null).requestedType).toBe("None");
    expect(
      resolveRequestedMusic("CUSTOM", CATALOG_DEFAULT, {
        type: "None",
        name: null,
        artist: null,
        externalId: null,
        url: null,
        audioFileUrl: null,
        audioFileName: null,
      }).requestedType,
    ).toBe("None");
  });
});

describe("resolveMusicApplication", () => {
  it("sem música pedida, não há nada a aplicar e nenhum motivo é gerado (não polui o log)", () => {
    const result = resolveMusicApplication("image", resolveRequestedMusic("NONE", CATALOG_DEFAULT, null));
    expect(result).toEqual({ applied: false, requestedType: "None", reason: null });
  });

  it("música do catálogo nunca é aplicada hoje, para nenhum tipo de post (limitação real da API atual)", () => {
    const requested = resolveRequestedMusic("ACCOUNT_DEFAULT", CATALOG_DEFAULT, null);
    for (const postType of ["image", "carousel", "reels"] as const) {
      const result = resolveMusicApplication(postType, requested);
      expect(result.applied).toBe(false);
      expect(result.requestedType).toBe("InstagramCatalog");
      expect(result.reason).toMatch(/catálogo do Instagram não pode ser adicionada automaticamente/);
    }
  });

  it("trilha própria em imagem ou carrossel nunca é aplicada (mídia estática não tem áudio)", () => {
    const custom: AccountDefaultMusic = { ...CATALOG_DEFAULT, type: "CustomAudio" };
    const requested = resolveRequestedMusic("ACCOUNT_DEFAULT", custom, null);
    for (const postType of ["image", "carousel"] as const) {
      const result = resolveMusicApplication(postType, requested);
      expect(result.applied).toBe(false);
      expect(result.reason).toMatch(/não reproduz/);
    }
  });

  it("trilha própria em Reel ainda não é aplicada (sem etapa de mixagem), mas o motivo é diferente do de imagem/carrossel", () => {
    const custom: AccountDefaultMusic = { ...CATALOG_DEFAULT, type: "CustomAudio" };
    const requested = resolveRequestedMusic("ACCOUNT_DEFAULT", custom, null);
    const result = resolveMusicApplication("reels", requested);
    expect(result.applied).toBe(false);
    expect(result.reason).toMatch(/mixagem de áudio/);
  });

  it("nunca lança, para nenhuma combinação de tipo de post e tipo de música", () => {
    const combos: Array<[typeof CATALOG_DEFAULT.type, "image" | "carousel" | "reels"]> = [
      ["InstagramCatalog", "image"],
      ["InstagramCatalog", "carousel"],
      ["InstagramCatalog", "reels"],
      ["CustomAudio", "image"],
      ["CustomAudio", "carousel"],
      ["CustomAudio", "reels"],
    ];
    for (const [type, postType] of combos) {
      const requested = resolveRequestedMusic("ACCOUNT_DEFAULT", { ...CATALOG_DEFAULT, type }, null);
      expect(() => resolveMusicApplication(postType, requested)).not.toThrow();
    }
  });
});
