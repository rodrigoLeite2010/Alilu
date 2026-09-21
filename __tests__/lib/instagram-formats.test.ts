import { describe, expect, it } from "vitest";
import { DEFAULT_FORMAT_ID, getFormatById, isPostFormatId, POST_FORMATS } from "@/lib/instagram/formats";

describe("lib/instagram/formats", () => {
  it("define exatamente os três formatos da ETAPA 3, com a resolução correta", () => {
    expect(POST_FORMATS).toHaveLength(3);
    expect(POST_FORMATS.map((format) => ({ id: format.id, width: format.width, height: format.height }))).toEqual([
      { id: "quadrado", width: 1080, height: 1080 },
      { id: "vertical", width: 1080, height: 1350 },
      { id: "stories", width: 1080, height: 1920 },
    ]);
  });

  it("cada formato tem um id único", () => {
    const ids = POST_FORMATS.map((format) => format.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getFormatById resolve um formato válido", () => {
    expect(getFormatById("stories")).toMatchObject({ width: 1080, height: 1920 });
  });

  it("getFormatById volta para o formato padrão quando o id é desconhecido", () => {
    expect(getFormatById("inexistente").id).toBe(DEFAULT_FORMAT_ID);
  });

  it("isPostFormatId distingue ids válidos de inválidos", () => {
    expect(isPostFormatId("quadrado")).toBe(true);
    expect(isPostFormatId("hexagonal")).toBe(false);
  });
});
