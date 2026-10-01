// Overlays fixos (texto/logo/URL) aplicados DEPOIS da IA: validação,
// modo simples, argumentos do FFmpeg e — validação visual — o texto que
// sai no MP4 final é exatamente o desenhado pelo Alilu (nunca pela IA).
import { describe, expect, it } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  OverlayValidationError,
  buildSimpleOverlays,
  simpleInputFromOverlays,
  validateOverlays,
  type AiVideoOverlay,
} from "@/lib/ai-video/overlays";
import { extractFrameRgba, makeLogoPng, makeSolidMp4 } from "../helpers/ai-video-media";

const overlayService = await import("@/lib/ai-video/backend/video-overlay-service");

const allowAll = () => true;

function textOverlay(overrides: Partial<AiVideoOverlay> = {}): AiVideoOverlay {
  return {
    id: "url",
    type: "URL",
    text: "www.alilu.com.br",
    imageUrl: null,
    x: 0.1,
    y: 0.8,
    width: 0.8,
    height: 0.08,
    fontSize: 0.05,
    fontFamily: "sans",
    fontWeight: "bold",
    textAlign: "center",
    backgroundColor: "#000000a6",
    textColor: "#ffffff",
    opacity: 1,
    startTime: 0,
    endTime: null,
    zIndex: 0,
    ...overrides,
  };
}

describe("validateOverlays", () => {
  it("normaliza e ordena por camada", () => {
    const result = validateOverlays(
      [
        { type: "TEXT", text: "  Promoção   de inverno ", x: 0.1, y: 0.1, width: 0.8, height: 0.1, zIndex: 2 },
        { type: "URL", text: "www.alilu.com.br", x: 0.1, y: 0.8, width: 0.8, height: 0.06, zIndex: 1 },
      ],
      allowAll,
    );
    expect(result.map((o) => o.text)).toEqual(["www.alilu.com.br", "Promoção de inverno"]);
    expect(result[0]).toMatchObject({ fontFamily: "sans", textAlign: "center", opacity: 1, endTime: null });
  });

  it("recusa texto vazio, fora do quadro, cor inválida, tempo inválido e logo de URL não permitida", () => {
    const base = { type: "TEXT", text: "Oi", x: 0.1, y: 0.1, width: 0.5, height: 0.1 };
    expect(() => validateOverlays([{ ...base, text: "   " }], allowAll)).toThrow(OverlayValidationError);
    expect(() => validateOverlays([{ ...base, x: 0.8 }], allowAll)).toThrow(OverlayValidationError);
    expect(() => validateOverlays([{ ...base, backgroundColor: "red" }], allowAll)).toThrow(OverlayValidationError);
    expect(() => validateOverlays([{ ...base, startTime: 3, endTime: 2 }], allowAll)).toThrow(OverlayValidationError);
    expect(() => validateOverlays([{ type: "LOGO", imageUrl: "https://evil.example.com/a.png", x: 0, y: 0, width: 0.2, height: 0.1 }], () => false)).toThrow(
      OverlayValidationError,
    );
    expect(() => validateOverlays(Array.from({ length: 9 }, () => base), allowAll)).toThrow(OverlayValidationError);
    expect(validateOverlays(undefined, allowAll)).toEqual([]);
  });
});

describe("modo simples", () => {
  it("empilha itens na mesma posição sem sobrepor e faz o caminho inverso", () => {
    const overlays = buildSimpleOverlays({
      logoUrl: "https://x.public.blob.vercel-storage.com/ai-video/u/input/logo.png",
      logoPosition: "top-left",
      mainText: "Promoção de inverno",
      secondaryText: "Só até domingo",
      url: "www.alilu.com.br",
    });
    expect(overlays.map((o) => o.id)).toEqual(["logo", "main", "secondary", "url"]);
    const bottom = overlays.filter((o) => o.id !== "logo");
    for (let i = 1; i < bottom.length; i += 1) expect(bottom[i].y).toBeGreaterThanOrEqual(bottom[i - 1].y + bottom[i - 1].height);
    for (const overlay of overlays) {
      expect(overlay.x + overlay.width).toBeLessThanOrEqual(1);
      expect(overlay.y + overlay.height).toBeLessThanOrEqual(1);
    }
    expect(validateOverlays(overlays, allowAll)).toHaveLength(4);
    const back = simpleInputFromOverlays(overlays);
    expect(back).toMatchObject({ mainText: "Promoção de inverno", url: "www.alilu.com.br", logoPosition: "top-left", urlPosition: "bottom-center" });
  });

  it("sem textos nem logo → nenhum overlay (só anima a imagem)", () => {
    expect(buildSimpleOverlays({ mainText: "  ", url: "" })).toEqual([]);
  });
});

describe("FFmpeg", () => {
  it("monta uma camada por overlay com janela de tempo, na ordem", () => {
    const args = overlayService.buildOverlayFfmpegArgs(
      "/tmp/in.mp4",
      [
        { path: "/tmp/a.png", startTime: 0, endTime: null },
        { path: "/tmp/b.png", startTime: 1, endTime: 3.5 },
      ],
      "/tmp/out.mp4",
    );
    const filter = args[args.indexOf("-filter_complex") + 1];
    expect(filter).toBe(
      "[0:v][1:v]overlay=0:0:format=auto[v1];[v1][2:v]overlay=0:0:format=auto:enable='between(t,1,3.5)'[v2];[v2]crop=trunc(iw/2)*2:trunc(ih/2)*2[vout]",
    );
    expect(args).toContain("0:a?");
    expect(args.at(-1)).toBe("/tmp/out.mp4");
  });

  it("MP4 vazio ou corrompido é detectado (devolução automática)", async () => {
    await expect(overlayService.processAiVideo({ videoBuffer: Buffer.alloc(0), overlays: [], loadOverlayImage: async () => Buffer.alloc(0) })).rejects.toBeInstanceOf(
      overlayService.VideoOutputInvalidError,
    );
    await expect(
      overlayService.processAiVideo({ videoBuffer: Buffer.from("não é um vídeo".repeat(200)), overlays: [], loadOverlayImage: async () => Buffer.alloc(0) }),
    ).rejects.toBeInstanceOf(overlayService.VideoOutputInvalidError);
  }, 60_000);

  it("sem overlays devolve o vídeo original intacto", async () => {
    const mp4 = makeSolidMp4();
    const result = await overlayService.processAiVideo({ videoBuffer: mp4, overlays: [], loadOverlayImage: async () => Buffer.alloc(0) });
    expect(result.overlaysApplied).toBe(0);
    expect(result.buffer.equals(mp4)).toBe(true);
    expect(result.probe).toMatchObject({ hasVideo: true, width: 360, height: 640 });
  }, 60_000);

  it("VALIDAÇÃO VISUAL: www.alilu.com.br sai no vídeo exatamente como desenhado pelo Alilu", async () => {
    const width = 360;
    const height = 640;
    const mp4 = makeSolidMp4({ width, height, color: "0x1e40af" });
    const overlay = textOverlay();
    const result = await overlayService.processAiVideo({ videoBuffer: mp4, overlays: [overlay], loadOverlayImage: async () => Buffer.alloc(0) });
    expect(result.overlaysApplied).toBe(1);
    expect(result.probe).toMatchObject({ hasVideo: true, width, height });
    expect(result.probe.durationSeconds).toBeGreaterThan(1.5);

    // Esperado: a mesma camada desenhada sobre o fundo azul (composição feita aqui, sem FFmpeg).
    const layer = await loadImage(await overlayService.renderOverlayLayer(overlay, width, height, null));
    const expectedCanvas = createCanvas(width, height);
    const ctx = expectedCanvas.getContext("2d");
    ctx.fillStyle = "#1e40af";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(layer, 0, 0);
    const expected = ctx.getImageData(0, 0, width, height).data;
    const actual = extractFrameRgba(result.buffer, width, height, 1);

    // Compara só a caixa do texto: diferença média pequena = mesmos pixels (sobra só a compressão do vídeo).
    const box = { x0: Math.round(overlay.x * width), y0: Math.round(overlay.y * height), x1: Math.round((overlay.x + overlay.width) * width), y1: Math.round((overlay.y + overlay.height) * height) };
    let diff = 0;
    let count = 0;
    let textPixels = 0;
    for (let y = box.y0; y < box.y1; y += 1) {
      for (let x = box.x0; x < box.x1; x += 1) {
        const i = (y * width + x) * 4;
        diff += Math.abs(actual[i] - expected[i]) + Math.abs(actual[i + 1] - expected[i + 1]) + Math.abs(actual[i + 2] - expected[i + 2]);
        count += 3;
        if (expected[i] > 200 && expected[i + 1] > 200 && expected[i + 2] > 200) textPixels += 1;
      }
    }
    expect(textPixels).toBeGreaterThan(200); // há texto branco de verdade na caixa
    expect(diff / count).toBeLessThan(12); // e ele bate com o renderizado (≈ só ruído de compressão)

    // Fora da caixa, o fundo segue intocado (azul).
    const outside = (100 * width + 180) * 4;
    expect(actual[outside + 2]).toBeGreaterThan(140);
    expect(actual[outside]).toBeLessThan(70);
  }, 90_000);

  it("o texto encolhe para caber na caixa e nunca é cortado nem alterado", async () => {
    const canvas = createCanvas(360, 640);
    const ctx = canvas.getContext("2d");
    const long = textOverlay({ text: "Promoção válida em todas as lojas físicas e no site www.alilu.com.br", height: 0.1 });
    const layout = overlayService.layoutOverlayText(ctx, long, 640, Math.round(long.width * 360), Math.round(long.height * 640));
    expect(layout.lines.join(" ")).toBe(long.text);
    expect(layout.fontPx).toBeLessThan(Math.round(long.fontSize * 640));
  });

  it("logo é desenhado na posição pedida", async () => {
    const width = 360;
    const height = 640;
    const mp4 = makeSolidMp4({ width, height });
    const logo = textOverlay({ id: "logo", type: "LOGO", text: null, imageUrl: "https://x/logo.png", x: 0.04, y: 0.04, width: 0.3, height: 0.1, textAlign: "left" });
    const result = await overlayService.processAiVideo({ videoBuffer: mp4, overlays: [logo], loadOverlayImage: async () => makeLogoPng() });
    const frame = extractFrameRgba(result.buffer, width, height, 1);
    const i = (Math.round(0.09 * height) * width + Math.round(0.1 * width)) * 4; // dentro do logo (laranja)
    expect(frame[i]).toBeGreaterThan(200);
    expect(frame[i + 2]).toBeLessThan(80);
  }, 90_000);
});
