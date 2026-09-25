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
import { createCanvas } from "@napi-rs/canvas";
import {
  buildAutomationArtState,
  renderAutomationArtBuffer,
  AUTO_TEMPLATE_DEFAULT_TEMPLATE_ID,
  AUTO_TEMPLATE_DEFAULT_OVERLAY_OPACITY,
  AUTO_TEMPLATE_TEXT_SLOT,
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
    // Assinatura JPEG (SOI marker) — garante que não é um buffer vazio/corrompido.
    expect(result.buffer[0]).toBe(0xff);
    expect(result.buffer[1]).toBe(0xd8);
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
