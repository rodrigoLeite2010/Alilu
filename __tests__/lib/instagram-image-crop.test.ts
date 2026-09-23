import { describe, expect, it } from "vitest";
import { computeCoverRect, panImageFocus } from "@/lib/instagram/layout-math";
import {
  MAX_IMAGE_ZOOM,
  clearBackgroundImage,
  createInitialEditorState,
  deserializeEditorState,
  serializeEditorState,
  setBackgroundImage,
  setBackgroundImageFocus,
  setBackgroundImageStorageUrl,
  setBackgroundImageZoom,
  updateTextValue,
} from "@/lib/instagram/editor-state";

describe("crop da imagem do template (cover + zoom)", () => {
  it("zoom 1 preenche a área sem distorcer (mesma proporção da área)", () => {
    const rect = computeCoverRect(1080, 1350, 4000, 3000, 0.5, 0.5, 1);
    expect(rect.sHeight).toBe(3000);
    expect(rect.sWidth / rect.sHeight).toBeCloseTo(1080 / 1350, 6);
    expect(rect.sx).toBeCloseTo((4000 - rect.sWidth) / 2, 6);
  });

  it("zoom 2 recorta metade da janela, mantendo a proporção e o centro", () => {
    const base = computeCoverRect(1000, 1000, 2000, 2000, 0.5, 0.5, 1);
    const zoomed = computeCoverRect(1000, 1000, 2000, 2000, 0.5, 0.5, 2);
    expect(zoomed.sWidth).toBe(base.sWidth / 2);
    expect(zoomed.sHeight).toBe(base.sHeight / 2);
    expect(zoomed.sx).toBe(500);
    expect(zoomed.sy).toBe(500);
  });

  it("zoom abaixo de 1 é tratado como 1 (nunca deixa buraco)", () => {
    expect(computeCoverRect(1000, 1000, 2000, 1000, 0.5, 0.5, 0.3)).toEqual(computeCoverRect(1000, 1000, 2000, 1000));
  });

  it("arrastar a foto para a direita mostra mais do lado esquerdo", () => {
    const next = panImageFocus({
      focusXFrac: 0.5, focusYFrac: 0.5, deltaXFrac: 0.2, deltaYFrac: 0,
      boxWidth: 1000, boxHeight: 1000, imageWidth: 3000, imageHeight: 1000, zoom: 1,
    });
    expect(next.focusXFrac).toBeLessThan(0.5);
    expect(next.focusYFrac).toBe(0.5); // sem sobra vertical
  });

  it("o reposicionamento fica sempre dentro da imagem", () => {
    const next = panImageFocus({
      focusXFrac: 0.1, focusYFrac: 0.9, deltaXFrac: 5, deltaYFrac: -5,
      boxWidth: 1000, boxHeight: 1000, imageWidth: 3000, imageHeight: 3000, zoom: 2,
    });
    expect(next).toEqual({ focusXFrac: 0, focusYFrac: 1 });
  });
});

describe("estado da imagem no editor", () => {
  const withImage = () =>
    setBackgroundImage(createInitialEditorState("promocao", "vertical"), {
      url: "blob:local-1", fileName: "foto.png", naturalWidth: 1200, naturalHeight: 900,
    });

  it("upload começa centralizado e sem zoom", () => {
    const state = withImage();
    expect(state.backgroundImage).toMatchObject({ url: "blob:local-1", focusXFrac: 0.5, focusYFrac: 0.5, zoom: 1, storageUrl: null });
  });

  it("zoom é limitado entre 1 e 4", () => {
    expect(setBackgroundImageZoom(withImage(), 10).backgroundImage.zoom).toBe(MAX_IMAGE_ZOOM);
    expect(setBackgroundImageZoom(withImage(), 0).backgroundImage.zoom).toBe(1);
  });

  it("trocar a imagem reinicia enquadramento/zoom e mantém textos do template", () => {
    let state = updateTextValue(withImage(), "heading", "Meu título");
    state = setBackgroundImageZoom(setBackgroundImageFocus(state, 0.1, 0.2), 2);
    state = setBackgroundImage(state, { url: "blob:local-2", fileName: "b.jpg", naturalWidth: 10, naturalHeight: 10 });
    expect(state.backgroundImage).toMatchObject({ url: "blob:local-2", zoom: 1, focusXFrac: 0.5 });
    expect(state.texts.heading.value).toBe("Meu título");
    expect(state.templateId).toBe("promocao");
  });

  it("remover a imagem não destrói o restante do template", () => {
    const state = clearBackgroundImage(updateTextValue(withImage(), "heading", "Fica"));
    expect(state.backgroundImage.url).toBeNull();
    expect(state.texts.heading.value).toBe("Fica");
  });

  it("serializa sem blob: e restaura enquadramento, zoom e textos", () => {
    let state = setBackgroundImageStorageUrl(withImage(), "https://blob.example.com/original.jpg");
    state = setBackgroundImageZoom(setBackgroundImageFocus(state, 0.3, 0.7), 1.8);
    state = updateTextValue(state, "heading", "Promoção");
    const saved = serializeEditorState(state);
    expect(JSON.stringify(saved)).not.toContain("blob:");

    const restored = deserializeEditorState(JSON.parse(JSON.stringify(saved)), "blob:novo");
    expect(restored?.backgroundImage).toMatchObject({
      url: "blob:novo", storageUrl: "https://blob.example.com/original.jpg", focusXFrac: 0.3, focusYFrac: 0.7, zoom: 1.8,
    });
    expect(restored?.texts.heading.value).toBe("Promoção");
    expect(restored?.formatId).toBe("vertical");
  });

  it("dados inválidos não quebram (retorna null)", () => {
    expect(deserializeEditorState(null)).toBeNull();
    expect(deserializeEditorState({ foo: 1 })).toBeNull();
  });
});
