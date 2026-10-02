// @vitest-environment node
// Regras puras da preparação de imagem no celular (tipo efetivo, quando converter, redução).
import { describe, expect, it } from "vitest";
import { effectiveImageType, needsConversion, targetSize } from "@/lib/ai-video/prepare-image";

describe("preparação da imagem (celular)", () => {
  it("corrige tipo vazio/variantes pela extensão", () => {
    expect(effectiveImageType({ type: "", name: "IMG_1234.JPG" })).toBe("image/jpeg");
    expect(effectiveImageType({ type: "image/jpg", name: "x" })).toBe("image/jpeg");
    expect(effectiveImageType({ type: "", name: "foto.HEIC" })).toBe("image/heic");
    expect(effectiveImageType({ type: "image/png", name: "logo.png" })).toBe("image/png");
  });

  it("converte HEIC e fotos grandes; deixa passar JPG/PNG/WebP leves", () => {
    expect(needsConversion("image/heic", 2_000_000)).toBe(true);
    expect(needsConversion("", 1_000)).toBe(true);
    expect(needsConversion("image/jpeg", 12 * 1024 * 1024)).toBe(true);
    expect(needsConversion("image/jpeg", 1_500_000)).toBe(false);
    expect(needsConversion("image/webp", 300_000)).toBe(false);
  });

  it("reduz mantendo a proporção, sem aumentar imagens pequenas", () => {
    expect(targetSize(4032, 3024)).toEqual({ width: 2560, height: 1920 });
    expect(targetSize(3024, 4032)).toEqual({ width: 1920, height: 2560 });
    expect(targetSize(1080, 1920)).toEqual({ width: 1080, height: 1920 });
  });
});
