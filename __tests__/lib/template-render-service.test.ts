// Piloto Automático — renderização server-side da arte AUTO_TEMPLATE
// (texto sobre a imagem escolhida). Cobre os bugs relatados: template
// errado por padrão (foto cortada numa área pequena, com texto de
// exemplo indevido tipo "50% OFF"), e texto longo demais não coube
// inteiro na arte. Usa o MESMO motor (@napi-rs/canvas + drawPost) que
// roda em produção — nenhuma implementação paralela.
import { describe, expect, it } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { imageSize } from "image-size";
import {
  buildAutomationArtState,
  renderAutomationArtBuffer,
  renderAutomationCarouselBuffers,
  splitAutomationVisualText,
  AUTO_TEMPLATE_DEFAULT_TEMPLATE_ID,
  AUTO_TEMPLATE_DEFAULT_OVERLAY_OPACITY,
  AUTO_TEMPLATE_JPEG_QUALITY,
  AUTO_TEMPLATE_TEXT_SLOT,
  automationVisualTextFits,
} from "@/lib/instagram/backend/template-render-service";

/** Gera uma foto de teste (PNG local) — evita depender de rede no teste. */
function makeTestImageFile(): string {
  const canvas = createCanvas(800, 1000);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#3355aa";
  ctx.fillRect(0, 0, 800, 1000);
  const dir = mkdtempSync(join(tmpdir(), "alilu-auto-template-"));
  const path = join(dir, "foto-fundo.png");
  writeFileSync(path, canvas.toBuffer("image/png"));
  return path;
}

async function countBrightPixels(buffer: Buffer): Promise<number> {
  const image = await loadImage(buffer);
  const canvas = createCanvas(image.naturalWidth, image.naturalHeight);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let bright = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index] > 180 && pixels[index + 1] > 180 && pixels[index + 2] > 180) bright += 1;
  }
  return bright;
}

/** Foto de teste de uma cor sólida escolhida — permite provar, por cor exata, que nada além do texto é pintado por cima (sem faixa). */
function makeSolidTestImageFile(hex: string): string {
  const canvas = createCanvas(800, 1000);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, 800, 1000);
  const dir = mkdtempSync(join(tmpdir(), "alilu-auto-template-solid-"));
  const path = join(dir, "foto-fundo-solida.png");
  writeFileSync(path, canvas.toBuffer("image/png"));
  return path;
}

async function countPixelsMatching(buffer: Buffer, predicate: (r: number, g: number, b: number) => boolean): Promise<number> {
  const image = await loadImage(buffer);
  const canvas = createCanvas(image.naturalWidth, image.naturalHeight);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let count = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (predicate(pixels[index], pixels[index + 1], pixels[index + 2])) count += 1;
  }
  return count;
}

describe("buildAutomationArtState (correção: template/foto errados)", () => {
  it("sem template escolhido, usa 'frase-motivacional' (foto em tela cheia) em vez do padrão do editor manual ('promocao', foto pequena recortada)", () => {
    const { state, templateIdUsed } = buildAutomationArtState({
      templateId: null,
      styleConfig: null,
      visualText: "Quinta-feira é prova de que você já venceu muita coisa na semana.",
      overlayOpacity: null,
    });
    expect(templateIdUsed).toBe(AUTO_TEMPLATE_DEFAULT_TEMPLATE_ID);
    expect(templateIdUsed).toBe("frase-motivacional");
    expect(state.templateId).toBe("frase-motivacional");
  });

  it("nunca deixa texto de exemplo do template (badge/body/footer) vazar para dentro da arte gerada", () => {
    // "promocao" tem badge="50% OFF", body="Só esta semana, aproveite!",
    // footer="Sua Loja Aqui" por padrão — exatamente o bug relatado
    // ("texto visual da imagem e a legenda misturados de forma errada").
    const { state } = buildAutomationArtState({
      templateId: "promocao",
      styleConfig: null,
      visualText: "20% OFF hoje",
      overlayOpacity: null,
    });
    expect(state.texts.badge.value).toBe("");
    expect(state.texts.body.value).toBe("");
    expect(state.texts.footer.value).toBe("");
    expect(state.texts[AUTO_TEMPLATE_TEXT_SLOT].value).toBe("20% OFF hoje");
  });

  it("injeta o texto visual exatamente no slot 'heading' — nunca na legenda, nunca em outro slot", () => {
    const { state } = buildAutomationArtState({
      templateId: "frase-motivacional",
      styleConfig: null,
      visualText: "Você não precisa vencer tudo hoje. Só precisa continuar.",
      overlayOpacity: null,
    });
    expect(state.texts.heading.value).toBe("Você não precisa vencer tudo hoje. Só precisa continuar.");
  });

  it("força contraste branco no texto principal quando o template usa foto em tela cheia", () => {
    const { state } = buildAutomationArtState({
      templateId: "comunicado",
      styleConfig: null,
      visualText: "Você é um criador de conteúdo motivacional para Instagram.",
      overlayOpacity: null,
    });
    expect(state.texts.heading.color).toBe("#ffffff");
    expect(state.texts.heading.bold).toBe(true);
  });

  it("aplica o véu padrão (20%) quando o dia não configurou nenhum", () => {
    const { state } = buildAutomationArtState({
      templateId: "frase-motivacional",
      styleConfig: null,
      visualText: "Frase",
      overlayOpacity: null,
    });
    expect(state.backgroundImage.overlayOpacity).toBe(AUTO_TEMPLATE_DEFAULT_OVERLAY_OPACITY);
  });

  it("respeita um véu explícito (0%, 10%, 30%, 40%) em vez do padrão", () => {
    const { state } = buildAutomationArtState({
      templateId: "frase-motivacional",
      styleConfig: null,
      visualText: "Frase",
      overlayOpacity: 0,
    });
    expect(state.backgroundImage.overlayOpacity).toBe(0);
  });
});

describe("renderAutomationArtBuffer (renderização real — mesmo motor do compositor manual)", () => {
  it("desenha a foto escolhida como fundo real e devolve um JPEG válido, não vazio", async () => {
    const sourceImageUrl = makeTestImageFile();
    const result = await renderAutomationArtBuffer({
      templateId: null,
      styleConfig: null,
      sourceImageUrl,
      visualText: "Você não precisa vencer tudo hoje. Só precisa continuar.",
      overlayOpacity: 0.2,
    });
    expect(result.templateIdUsed).toBe("frase-motivacional");
    expect(result.contentType).toBe("image/jpeg");
    expect(result.buffer.byteLength).toBeGreaterThan(1000);
    const dimensions = imageSize(result.buffer);
    expect(dimensions).toMatchObject({ width: 1080, height: 1350, type: "jpg" });
    expect(result).toMatchObject({
      sourceWidth: 800,
      sourceHeight: 1000,
      finalWidth: 1080,
      finalHeight: 1350,
      jpegQuality: AUTO_TEMPLATE_JPEG_QUALITY,
    });
    // Assinatura JPEG (SOI marker) — garante que não é um buffer vazio/corrompido.
    expect(result.buffer[0]).toBe(0xff);
    expect(result.buffer[1]).toBe(0xd8);
  });

  it("exporta JPEG em qualidade alta do @napi-rs/canvas (escala 0..100), não no 0.92 do browser", async () => {
    const sourceImageUrl = makeTestImageFile();
    const result = await renderAutomationArtBuffer({
      templateId: "frase-motivacional",
      styleConfig: null,
      sourceImageUrl,
      visualText: "Texto com boa definição sobre a imagem",
      overlayOpacity: 0.2,
    });

    const lowQualityCanvas = createCanvas(1080, 1350);
    const lowQualityCtx = lowQualityCanvas.getContext("2d");
    lowQualityCtx.fillStyle = "#3355aa";
    lowQualityCtx.fillRect(0, 0, 1080, 1350);
    const lowQualityBuffer = lowQualityCanvas.toBuffer("image/jpeg", 0.92);

    expect(AUTO_TEMPLATE_JPEG_QUALITY).toBe(92);
    expect(result.buffer.byteLength).toBeGreaterThan(lowQualityBuffer.byteLength);
  });

  it("renderiza pixels claros do texto visual sobre fundo escuro", async () => {
    const sourceImageUrl = makeTestImageFile();
    const result = await renderAutomationArtBuffer({
      templateId: "frase-motivacional",
      styleConfig: null,
      sourceImageUrl,
      visualText: "Você é um criador de conteúdo motivacional para Instagram.",
      overlayOpacity: 0.2,
    });

    await expect(countBrightPixels(result.buffer)).resolves.toBeGreaterThan(500);
  });

  it("um texto bem mais longo que o normal ainda gera uma arte válida (ajuste dinâmico de fonte, nunca trava/estoura)", async () => {
    const sourceImageUrl = makeTestImageFile();
    const longText =
      "Ninguém chega longe de uma vez só, chega repetindo o esforço todos os dias, mesmo quando parece que nada está mudando ainda, e é exatamente por isso que continuar importa mais do que ir rápido.";
    const result = await renderAutomationArtBuffer({
      templateId: "frase-motivacional",
      styleConfig: null,
      sourceImageUrl,
      visualText: longText.slice(0, 160),
      overlayOpacity: 0.2,
    });
    expect(result.buffer.byteLength).toBeGreaterThan(1000);
  });

  it("mensagem de erro clara (não trava o processo) quando a imagem de origem não pode ser carregada", async () => {
    await expect(
      renderAutomationArtBuffer({
        templateId: null,
        styleConfig: null,
        sourceImageUrl: "/caminho/que/nao/existe/foto.png",
        visualText: "Frase",
        overlayOpacity: 0.2,
      })
    ).rejects.toThrow(/imagem de origem/i);
  });
});

describe("drawAutomationVisualText — sem faixa preta atrás do texto, cor escolhida pelo usuário", () => {
  it("não pinta nenhuma faixa/retângulo escuro atrás do texto — só o véu configurado (aqui, nenhum) permanece visível", async () => {
    // Fundo sólido claro e véu 0% — se ainda existisse a faixa preta
    // antiga atrás do texto, apareceriam muitos pixels bem escuros; sem
    // ela, só a leve anti-serrilhagem das bordas das letras (poucos
    // pixels, nunca um bloco).
    const sourceImageUrl = makeSolidTestImageFile("#dedede");
    const result = await renderAutomationArtBuffer({
      templateId: "frase-motivacional",
      styleConfig: null,
      sourceImageUrl,
      visualText: "Texto curto",
      overlayOpacity: 0,
    });

    const nearBlackPixels = await countPixelsMatching(result.buffer, (r, g, b) => r < 30 && g < 30 && b < 30);
    const totalPixels = result.finalWidth * result.finalHeight;
    // Uma faixa cobrindo a área do texto seria uma fração grande e
    // contígua da imagem — bem mais que 0,5% dos pixels; a anti-serrilhagem
    // das letras sozinha nunca chega perto disso.
    expect(nearBlackPixels).toBeLessThan(totalPixels * 0.005);
  });

  it("usa branco como cor padrão quando o dia não escolheu nenhuma cor", async () => {
    const sourceImageUrl = makeSolidTestImageFile("#1a1a2e");
    const result = await renderAutomationArtBuffer({
      templateId: "frase-motivacional",
      styleConfig: null,
      sourceImageUrl,
      visualText: "Frase em branco por padrão",
      overlayOpacity: 0,
      visualTextColor: null,
    });

    await expect(countBrightPixels(result.buffer)).resolves.toBeGreaterThan(200);
  });

  it("desenha o texto na cor escolhida pelo usuário (ex.: verde puro), em vez do branco padrão", async () => {
    const sourceImageUrl = makeSolidTestImageFile("#1a1a2e");
    const result = await renderAutomationArtBuffer({
      templateId: "frase-motivacional",
      styleConfig: null,
      sourceImageUrl,
      visualText: "Frase verde",
      overlayOpacity: 0,
      visualTextColor: "#00ff00",
    });

    const greenPixels = await countPixelsMatching(result.buffer, (r, g, b) => g > 180 && r < 100 && b < 100);
    const whitePixels = await countPixelsMatching(result.buffer, (r, g, b) => r > 220 && g > 220 && b > 220);
    expect(greenPixels).toBeGreaterThan(200);
    // Praticamente nenhum pixel branco puro — a cor de verdade usada foi verde, não o padrão.
    expect(whitePixels).toBeLessThan(greenPixels);
  });

  it("uma cor inválida (não-hex) cai de volta pro branco padrão, em vez de quebrar a renderização", async () => {
    const sourceImageUrl = makeSolidTestImageFile("#1a1a2e");
    const result = await renderAutomationArtBuffer({
      templateId: "frase-motivacional",
      styleConfig: null,
      sourceImageUrl,
      visualText: "Frase com cor inválida",
      overlayOpacity: 0,
      visualTextColor: "not-a-color",
    });

    await expect(countBrightPixels(result.buffer)).resolves.toBeGreaterThan(200);
  });
});

describe("splitAutomationVisualText (mesmo motor de divisão do Carrossel automático manual)", () => {
  it("um texto curto vira um único slide, sem sobra", () => {
    const { slideTexts, overflowText } = splitAutomationVisualText("Um texto curto para um só slide.", 10);
    expect(slideTexts).toEqual(["Um texto curto para um só slide."]);
    expect(overflowText).toBeNull();
  });

  it("um texto longo (vários parágrafos) é dividido em mais de um slide, sem perder nenhum trecho, quando cabe dentro do limite de slides", () => {
    const paragraphs = Array.from(
      { length: 8 },
      (_, index) =>
        `Parágrafo número ${index + 1}: uma frase razoavelmente longa para ajudar a estourar o espaço de um slide só e forçar a divisão em vários pedaços consecutivos.`,
    );
    const longText = paragraphs.join("\n\n");

    const { slideTexts, overflowText } = splitAutomationVisualText(longText, 10);
    expect(slideTexts.length).toBeGreaterThan(1);
    expect(slideTexts.length).toBeLessThanOrEqual(10);
    expect(overflowText).toBeNull();
    // Nenhuma palavra perdida: o texto de todos os slides, concatenado, contém cada parágrafo original.
    const joined = slideTexts.join(" ");
    for (const paragraph of paragraphs) {
      const firstSentence = paragraph.split(":")[0];
      expect(joined).toContain(firstSentence);
    }
  });

  it("um texto que precisaria de mais slides do que o permitido é cortado em maxSlides, com o resto devolvido em overflowText (nunca descartado em silêncio)", () => {
    const paragraphs = Array.from(
      { length: 10 },
      (_, index) =>
        `Parágrafo número ${index + 1}: uma frase razoavelmente longa para ajudar a estourar o espaço de um slide só e forçar a divisão em vários pedaços consecutivos, item exclusivo ${index + 1}.`,
    );
    const longText = paragraphs.join("\n\n");

    const { slideTexts, overflowText } = splitAutomationVisualText(longText, 2);
    expect(slideTexts.length).toBe(2);
    expect(overflowText).not.toBeNull();
    expect(overflowText).toContain("item exclusivo 10");
  });
});

describe("renderAutomationCarouselBuffers (um slide por pedaço do texto, mesma imagem/template/véu/cor em todos)", () => {
  it("gera um buffer JPEG válido por slide, na ordem, cada um já com o texto certo desse slide", async () => {
    const sourceImageUrl = makeTestImageFile();
    const paragraphs = Array.from(
      { length: 4 },
      (_, index) => `Parágrafo ${index + 1}: texto suficientemente longo para ajudar a estourar o espaço de um slide só.`,
    );
    const visualText = paragraphs.join("\n\n");

    const result = await renderAutomationCarouselBuffers({
      templateId: "frase-motivacional",
      styleConfig: null,
      sourceImageUrl,
      visualText,
      overlayOpacity: 0.2,
      maxSlides: 10,
    });

    expect(result.overflowText).toBeNull();
    expect(result.slides.length).toBeGreaterThan(1);
    const { slideTexts } = splitAutomationVisualText(visualText, 10);
    expect(result.slides.map((slide) => slide.text)).toEqual(slideTexts);

    for (const slide of result.slides) {
      expect(slide.contentType).toBe("image/jpeg");
      expect(slide.buffer.byteLength).toBeGreaterThan(1000);
      expect(slide.buffer[0]).toBe(0xff);
      expect(slide.buffer[1]).toBe(0xd8);
      expect(slide.templateIdUsed).toBe("frase-motivacional");
      expect(slide.finalWidth).toBe(1080);
      expect(slide.finalHeight).toBe(1350);
    }
  });

  it("devolve overflowText quando o texto não cabe inteiro em maxSlides, mas ainda assim gera os slides que couberam", async () => {
    const sourceImageUrl = makeTestImageFile();
    const paragraphs = Array.from(
      { length: 10 },
      (_, index) => `Parágrafo ${index + 1}: texto suficientemente longo para ajudar a estourar o espaço de um slide só, item ${index + 1}.`,
    );
    const visualText = paragraphs.join("\n\n");

    const result = await renderAutomationCarouselBuffers({
      templateId: "frase-motivacional",
      styleConfig: null,
      sourceImageUrl,
      visualText,
      overlayOpacity: 0.2,
      maxSlides: 2,
    });

    expect(result.slides.length).toBe(2);
    expect(result.overflowText).not.toBeNull();
  });

  it("recusa texto vazio (ou só espaços) com uma mensagem clara, em vez de gerar um carrossel sem nada", async () => {
    const sourceImageUrl = makeTestImageFile();
    await expect(
      renderAutomationCarouselBuffers({
        templateId: "frase-motivacional",
        styleConfig: null,
        sourceImageUrl,
        visualText: "   ",
        overlayOpacity: 0.2,
        maxSlides: 10,
      }),
    ).rejects.toThrow(/texto do carrossel/i);
  });

  it("mensagem de erro clara quando a imagem de origem não pode ser carregada", async () => {
    await expect(
      renderAutomationCarouselBuffers({
        templateId: "frase-motivacional",
        styleConfig: null,
        sourceImageUrl: "/caminho/que/nao/existe/foto.png",
        visualText: "Texto qualquer",
        overlayOpacity: 0.2,
        maxSlides: 10,
      }),
    ).rejects.toThrow(/imagem de origem/i);
  });
});

describe("Story com texto longo (2 parágrafos, ~100 palavras — prompt do Piloto)", () => {
  const STORY_TEXT =
    "Segunda-feira chega como uma página em branco, e isso não precisa assustar. Cada recomeço carrega a chance de fazer diferente, com mais calma, mais coragem e mais carinho por quem você está se tornando. Os planos que ficaram para trás ainda podem ganhar vida se você der o primeiro passo hoje.\n\n" +
    "Não espere a semana perfeita para acreditar em si. Pequenas escolhas feitas com disciplina constroem grandes conquistas, e cada esforço silencioso conta mais do que parece. Respire fundo, siga em frente e lembre-se do quanto você já superou até aqui. Estou aqui olhando e acreditando em você.";

  it("cabe inteiro no Story 9:16, sem cortar com reticências e com fonte legível", () => {
    expect(STORY_TEXT.split(/\s+/).length).toBeGreaterThanOrEqual(90);
    const result = automationVisualTextFits("stories", STORY_TEXT);
    expect(result.fits).toBe(true);
    expect(result.fontSizePx).toBeGreaterThanOrEqual(38);
  });

  it("o post vertical continua com o mesmo comportamento (texto curto)", () => {
    expect(automationVisualTextFits("vertical", "Hoje é um novo começo").fits).toBe(true);
  });
});
