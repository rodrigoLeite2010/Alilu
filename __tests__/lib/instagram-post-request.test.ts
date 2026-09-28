// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readPostExtraFields, validateTemplateData } from "@/lib/instagram/backend/post-request";
import { sanitizeOAuthReturnPath } from "@/lib/instagram/backend/oauth-state";
import { buildPublicationLogLine } from "@/lib/instagram/backend/publication-log";

describe("campos extras da publicação", () => {
  it("aceita origem, template e fuso válidos", () => {
    expect(readPostExtraFields({ source: "VIRAL_POST", templateId: "promocao", timezone: "America/Sao_Paulo", templateData: { v: 1 } })).toEqual({
      fields: { source: "VIRAL_POST", templateId: "promocao", timezone: "America/Sao_Paulo", templateData: { v: 1 } },
    });
  });

  it("recusa origem desconhecida e imagens embutidas no template", () => {
    expect(readPostExtraFields({ source: "HACK" })).toHaveProperty("error");
    expect(validateTemplateData({ image: "data:image/png;base64,AAAA" })).toMatch(/embutidas/);
    expect(validateTemplateData({ image: "blob:https://x/1" })).toMatch(/embutidas/);
    expect(validateTemplateData({ big: "x".repeat(70_000) })).toMatch(/grandes/);
  });
});

describe("música da publicação", () => {
  it("aceita musicMode ACCOUNT_DEFAULT, NONE ou CUSTOM", () => {
    expect(readPostExtraFields({ musicMode: "ACCOUNT_DEFAULT" })).toEqual({ fields: { musicMode: "ACCOUNT_DEFAULT" } });
    expect(readPostExtraFields({ musicMode: "NONE" })).toEqual({ fields: { musicMode: "NONE" } });
  });

  it("recusa um musicMode desconhecido", () => {
    expect(readPostExtraFields({ musicMode: "SOMETHING_ELSE" })).toHaveProperty("error");
  });

  it("aceita musicSelection CUSTOM com todos os campos, gravando null nos campos ausentes", () => {
    const result = readPostExtraFields({
      musicMode: "CUSTOM",
      musicSelection: { type: "InstagramCatalog", name: "Beautiful Day", artist: "U2" },
    });
    expect(result).toEqual({
      fields: {
        musicMode: "CUSTOM",
        musicSelection: {
          type: "InstagramCatalog",
          name: "Beautiful Day",
          artist: "U2",
          externalId: null,
          url: null,
          audioFileUrl: null,
          audioFileName: null,
        },
      },
    });
  });

  it("recusa musicSelection com type inválido ou campos que não são texto", () => {
    expect(readPostExtraFields({ musicSelection: { type: "Spotify" } })).toHaveProperty("error");
    expect(readPostExtraFields({ musicSelection: { type: "None", name: 123 } })).toHaveProperty("error");
  });

  it("musicSelection ausente/nulo não é um erro (musicMode ACCOUNT_DEFAULT/NONE não precisa dele)", () => {
    expect(readPostExtraFields({ musicMode: "NONE", musicSelection: null })).toEqual({
      fields: { musicMode: "NONE", musicSelection: null },
    });
  });
});

describe("retorno depois da conexão com o Instagram", () => {
  it("só aceita caminhos internos da área Instagram", () => {
    expect(sanitizeOAuthReturnPath("/instagram/posts-virais?editar=1")).toBe("/instagram/posts-virais?editar=1");
    expect(sanitizeOAuthReturnPath("https://evil.com/instagram")).toBeNull();
    expect(sanitizeOAuthReturnPath("//evil.com")).toBeNull();
    expect(sanitizeOAuthReturnPath("/admin")).toBeNull();
    expect(sanitizeOAuthReturnPath(null)).toBeNull();
  });
});

describe("log de publicação", () => {
  it("só grava campos permitidos (nunca token ou legenda)", () => {
    const line = buildPublicationLogLine({
      event: "publish.start",
      publicationId: "p1",
      status: "PROCESSING",
      ...({ accessToken: "IGAA-secreto", caption: "texto do usuário" } as object),
    });
    expect(line).not.toContain("IGAA-secreto");
    expect(line).not.toContain("texto do usuário");
    expect(JSON.parse(line)).toMatchObject({ scope: "instagram-publish", event: "publish.start", publicationId: "p1" });
  });
});
