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
