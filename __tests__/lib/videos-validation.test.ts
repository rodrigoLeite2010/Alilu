import { describe, expect, it } from "vitest";
import { parseSplitScreenRequest } from "@/lib/videos/validation";
import { MAX_OUTPUT_DURATION_SECONDS } from "@/lib/videos/config";

/**
 * Testes de validação do corpo de POST /api/videos/split-screen: aceita
 * um corpo válido, rejeita formato/layout/modo desconhecido, rejeita
 * corte inválido (fim <= início) e rejeita duração final acima do limite
 * (usando os valores enviados pelo cliente como pré-checagem otimista —
 * a checagem que realmente importa, com a duração REAL medida via
 * ffprobe, é feita em lib/videos/backend/video-processing-service.ts,
 * coberta pelos testes de integração).
 */

const VALID_BODY = {
  primaryBlobUrl: "https://example.public.blob.vercel-storage.com/videos/uploads/abc-principal.mp4",
  secondaryBlobUrl: "https://example.public.blob.vercel-storage.com/videos/uploads/def-complementar.mp4",
  outputFormat: "vertical",
  layoutRatio: "50-50",
  primaryTrim: { startSeconds: 0, endSeconds: 10 },
  secondaryTrim: { startSeconds: 0, endSeconds: 8 },
  durationMode: "loop",
  audio: { source: "primary" },
};

describe("parseSplitScreenRequest — corpo válido", () => {
  it("aceita um corpo bem formado e devolve os valores tipados", () => {
    const result = parseSplitScreenRequest(VALID_BODY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.outputFormat).toBe("vertical");
      expect(result.value.audio).toEqual({ source: "primary" });
    }
  });

  it('aceita fonte de áudio "both" com os dois volumes', () => {
    const result = parseSplitScreenRequest({
      ...VALID_BODY,
      audio: { source: "both", primaryVolumePercent: 70, secondaryVolumePercent: 40 },
    });
    expect(result.ok).toBe(true);
  });
});

describe("parseSplitScreenRequest — URLs de blob", () => {
  it("rejeita quando falta a URL do vídeo principal", () => {
    const rest: Record<string, unknown> = { ...VALID_BODY };
    delete rest.primaryBlobUrl;
    const result = parseSplitScreenRequest(rest);
    expect(result.ok).toBe(false);
  });

  it("rejeita uma URL que não vem do prefixo de upload desta categoria", () => {
    const result = parseSplitScreenRequest({
      ...VALID_BODY,
      primaryBlobUrl: "https://example.public.blob.vercel-storage.com/instagram-media/abc/foto.jpg",
    });
    expect(result.ok).toBe(false);
  });

  it("rejeita uma URL que não é https", () => {
    const result = parseSplitScreenRequest({
      ...VALID_BODY,
      primaryBlobUrl: "http://example.com/videos/uploads/abc.mp4",
    });
    expect(result.ok).toBe(false);
  });

  it("rejeita uma URL https de outro domínio que só imita o caminho de upload (proteção contra SSRF)", () => {
    const result = parseSplitScreenRequest({
      ...VALID_BODY,
      primaryBlobUrl: "https://atacante.exemplo/x/videos/uploads/abc.mp4",
    });
    expect(result.ok).toBe(false);
  });
});

describe("parseSplitScreenRequest — enums desconhecidos", () => {
  it("rejeita formato de saída desconhecido", () => {
    const result = parseSplitScreenRequest({ ...VALID_BODY, outputFormat: "16-9-cinema" });
    expect(result.ok).toBe(false);
  });

  it("rejeita proporção de layout desconhecida", () => {
    const result = parseSplitScreenRequest({ ...VALID_BODY, layoutRatio: "70-30" });
    expect(result.ok).toBe(false);
  });

  it("rejeita modo de duração desconhecido", () => {
    const result = parseSplitScreenRequest({ ...VALID_BODY, durationMode: "freeze" });
    expect(result.ok).toBe(false);
  });

  it("rejeita fonte de áudio desconhecida", () => {
    const result = parseSplitScreenRequest({ ...VALID_BODY, audio: { source: "podcast" } });
    expect(result.ok).toBe(false);
  });

  it('rejeita fonte de áudio "both" sem os volumes', () => {
    const result = parseSplitScreenRequest({ ...VALID_BODY, audio: { source: "both" } });
    expect(result.ok).toBe(false);
  });

  it('rejeita volume fora do intervalo 0–100 na fonte "both"', () => {
    const result = parseSplitScreenRequest({
      ...VALID_BODY,
      audio: { source: "both", primaryVolumePercent: 150, secondaryVolumePercent: 50 },
    });
    expect(result.ok).toBe(false);
  });
});

describe("parseSplitScreenRequest — corte (trim) inválido", () => {
  it("rejeita quando o fim do corte é igual ao início", () => {
    const result = parseSplitScreenRequest({
      ...VALID_BODY,
      primaryTrim: { startSeconds: 5, endSeconds: 5 },
    });
    expect(result.ok).toBe(false);
  });

  it("rejeita quando o fim do corte é menor que o início", () => {
    const result = parseSplitScreenRequest({
      ...VALID_BODY,
      secondaryTrim: { startSeconds: 8, endSeconds: 3 },
    });
    expect(result.ok).toBe(false);
  });

  it("rejeita início de corte negativo", () => {
    const result = parseSplitScreenRequest({
      ...VALID_BODY,
      primaryTrim: { startSeconds: -1, endSeconds: 5 },
    });
    expect(result.ok).toBe(false);
  });

  it("rejeita corte com valores não numéricos", () => {
    const result = parseSplitScreenRequest({
      ...VALID_BODY,
      primaryTrim: { startSeconds: "0", endSeconds: 5 },
    });
    expect(result.ok).toBe(false);
  });
});

describe("parseSplitScreenRequest — duração final acima do limite", () => {
  it('modo "loop": rejeita quando o corte do principal sozinho já passa do limite', () => {
    const result = parseSplitScreenRequest({
      ...VALID_BODY,
      durationMode: "loop",
      primaryTrim: { startSeconds: 0, endSeconds: MAX_OUTPUT_DURATION_SECONDS + 10 },
      secondaryTrim: { startSeconds: 0, endSeconds: 5 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(String(MAX_OUTPUT_DURATION_SECONDS));
    }
  });

  it('modo "shortest": aceita quando a MENOR das durações está dentro do limite, mesmo que a maior não esteja', () => {
    const result = parseSplitScreenRequest({
      ...VALID_BODY,
      durationMode: "shortest",
      primaryTrim: { startSeconds: 0, endSeconds: MAX_OUTPUT_DURATION_SECONDS + 20 },
      secondaryTrim: { startSeconds: 0, endSeconds: 10 },
    });
    expect(result.ok).toBe(true);
  });

  it('modo "shortest": rejeita quando até a menor das durações passa do limite', () => {
    const result = parseSplitScreenRequest({
      ...VALID_BODY,
      durationMode: "shortest",
      primaryTrim: { startSeconds: 0, endSeconds: MAX_OUTPUT_DURATION_SECONDS + 20 },
      secondaryTrim: { startSeconds: 0, endSeconds: MAX_OUTPUT_DURATION_SECONDS + 5 },
    });
    expect(result.ok).toBe(false);
  });

  it("aceita exatamente no limite (não passa de MAX_OUTPUT_DURATION_SECONDS)", () => {
    const result = parseSplitScreenRequest({
      ...VALID_BODY,
      durationMode: "loop",
      primaryTrim: { startSeconds: 0, endSeconds: MAX_OUTPUT_DURATION_SECONDS },
      secondaryTrim: { startSeconds: 0, endSeconds: 5 },
    });
    expect(result.ok).toBe(true);
  });
});

describe("parseSplitScreenRequest — corpo malformado", () => {
  it("rejeita corpo nulo", () => {
    expect(parseSplitScreenRequest(null).ok).toBe(false);
  });

  it("rejeita corpo que não é objeto", () => {
    expect(parseSplitScreenRequest("string qualquer").ok).toBe(false);
  });
});
