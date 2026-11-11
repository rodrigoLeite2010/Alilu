// @vitest-environment node
// Regras puras do Facebook: classificação de erros, especificação de Reels,
// suporte por tipo de publicação, leitura de `destinations` e status geral.
import { describe, expect, it, vi } from "vitest";
import { classifyFacebookError, FacebookReelProcessingError, needsPageReconnect } from "@/lib/facebook/backend/facebook-publish-errors";
import { facebookSupportFor, validateFacebookReelSpecs } from "@/lib/facebook/facebook-media-rules";
import { overallPublicationStatus } from "@/lib/facebook/destination-view";

vi.mock("@/lib/db/client", () => ({ getDb: () => { throw new Error("sem banco"); } }));
const { readSocialDestinations } = await import("@/lib/facebook/backend/social-destinations-service");

function graphError(details: unknown, unknownOutcome = false) {
  const error = new Error("x") as Error & { details: unknown; unknownOutcome: boolean };
  error.name = "FacebookGraphApiError";
  error.details = details;
  error.unknownOutcome = unknownOutcome;
  return error;
}

describe("classifyFacebookError", () => {
  it("token expirado/inválido pede reconexão (permanente)", () => {
    const result = classifyFacebookError(graphError({ error: { code: 190 } }));
    expect(result).toMatchObject({ kind: "permanent", reason: "token" });
    expect(needsPageReconnect(result.reason)).toBe(true);
  });
  it("permissão revogada (200/10) pede reconexão", () => {
    expect(classifyFacebookError(graphError({ error: { code: 200 } })).reason).toBe("permission");
    expect(classifyFacebookError(graphError({ error: { code: 10 } })).reason).toBe("permission");
  });
  it("limite de requisições e instabilidade são temporários", () => {
    expect(classifyFacebookError(graphError({ error: { code: 368 } }))).toMatchObject({ kind: "transient", reason: "rate_limit" });
    expect(classifyFacebookError(graphError({ error: { code: 2 } }))).toMatchObject({ kind: "transient" });
    expect(classifyFacebookError(graphError({ error: { code: 999, is_transient: true } }))).toMatchObject({ kind: "transient" });
  });
  it("timeout após envio = resultado desconhecido (reconciliar antes de repetir)", () => {
    expect(classifyFacebookError(graphError(null, true))).toMatchObject({ kind: "transient", reason: "unknown_result" });
  });
  it("especificação de Reel recusada vira mensagem clara", () => {
    const result = classifyFacebookError(graphError({ error: { code: 100, error_subcode: 1363128 } }));
    expect(result).toMatchObject({ kind: "permanent", reason: "media" });
    expect(result.message).toContain("duração");
  });
  it("direitos autorais", () => {
    expect(classifyFacebookError(new FacebookReelProcessingError(true)).reason).toBe("copyright");
  });
  it("nunca vaza a mensagem crua da Meta", () => {
    const result = classifyFacebookError(graphError({ error: { code: 1234, message: "segredo interno EAAB123" } }));
    expect(result.message).not.toContain("segredo");
  });
});

describe("validateFacebookReelSpecs", () => {
  it("aceita 1080x1920, 30 s, 30 fps, h264", () => {
    expect(validateFacebookReelSpecs({ width: 1080, height: 1920, durationSeconds: 30, fps: 30, videoCodec: "h264", hasVideo: true })).toBeNull();
  });
  it("recusa mais de 90 s, menos de 3 s, proporção errada, resolução baixa, fps e codec", () => {
    expect(validateFacebookReelSpecs({ durationSeconds: 120 })).toMatch(/90 segundos/);
    expect(validateFacebookReelSpecs({ durationSeconds: 2 })).toMatch(/3 segundos/);
    expect(validateFacebookReelSpecs({ width: 1920, height: 1080 })).toMatch(/9:16/);
    expect(validateFacebookReelSpecs({ width: 360, height: 640 })).toMatch(/Resolução/);
    expect(validateFacebookReelSpecs({ fps: 15 })).toMatch(/quadros/);
    expect(validateFacebookReelSpecs({ videoCodec: "prores" })).toMatch(/Codec/);
  });
  it("campos desconhecidos não bloqueiam (a Meta valida no envio)", () => {
    expect(validateFacebookReelSpecs({})).toBeNull();
  });
});

describe("facebookSupportFor", () => {
  it("imagem, carrossel de fotos e Reel são suportados; Story e carrossel com vídeo não", () => {
    expect(facebookSupportFor("image", false).supported).toBe(true);
    expect(facebookSupportFor("carousel", false).supported).toBe(true);
    expect(facebookSupportFor("reels", true).supported).toBe(true);
    expect(facebookSupportFor("story", false).supported).toBe(false);
    expect(facebookSupportFor("carousel", true).supported).toBe(false);
  });
});

describe("readSocialDestinations", () => {
  const page = "11111111-2222-3333-4444-555555555555";
  it("ausente = comportamento antigo (só Instagram)", () => {
    expect(readSocialDestinations(undefined)).toEqual({ value: null });
  });
  it("não permite salvar sem nenhuma rede", () => {
    expect(readSocialDestinations({ instagram: false, facebookPageIds: [] })).toHaveProperty("error");
  });
  it("somente Facebook, Instagram + Facebook e legenda própria", () => {
    expect(readSocialDestinations({ instagram: false, facebookPageIds: [page] })).toEqual({
      value: { instagram: false, facebookPageIds: [page], facebookCaption: null },
    });
    expect(readSocialDestinations({ instagram: true, facebookPageIds: [page, page], facebookCaption: "  Oi " })).toEqual({
      value: { instagram: true, facebookPageIds: [page], facebookCaption: "  Oi " },
    });
  });
  it("legenda do Facebook vazia = usa a principal", () => {
    expect(readSocialDestinations({ instagram: true, facebookPageIds: [page], facebookCaption: "   " })).toEqual({
      value: { instagram: true, facebookPageIds: [page], facebookCaption: null },
    });
  });
  it("recusa ids que não são uuid (nunca aceita page_id cru da Meta)", () => {
    expect(readSocialDestinations({ instagram: true, facebookPageIds: ["123456"] })).toHaveProperty("error");
  });
});

describe("overallPublicationStatus", () => {
  it("só é PUBLISHED quando todos os destinos publicaram", () => {
    expect(overallPublicationStatus({ instagramStatus: "PUBLISHED", destinations: [{ status: "PUBLISHED" }] })).toBe("PUBLISHED");
    expect(overallPublicationStatus({ instagramStatus: "PUBLISHED", destinations: [{ status: "FAILED" }] })).toBe("PARTIAL");
    expect(overallPublicationStatus({ instagramStatus: "PUBLISHED", destinations: [{ status: "PROCESSING" }] })).toBe("PENDING");
    expect(overallPublicationStatus({ instagramStatus: null, destinations: [{ status: "FAILED" }] })).toBe("FAILED");
  });
});
