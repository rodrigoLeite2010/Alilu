import { describe, expect, it } from "vitest";
import {
  applyColorComboToState,
  applyTemplateToState,
  clearBackgroundImage,
  createInitialEditorState,
  isSlotVisible,
  setBackgroundColor,
  setBackgroundImage,
  setBackgroundImageFocus,
  setBadgeColors,
  setFormat,
  updateTextOffset,
  updateTextStyle,
  updateTextValue,
} from "@/lib/instagram/editor-state";
import { getTemplateById } from "@/lib/instagram/templates";
import { getColorComboById } from "@/lib/instagram/colors";

describe("createInitialEditorState", () => {
  it("começa com os valores padrão do template escolhido", () => {
    const state = createInitialEditorState("promocao", "quadrado");
    const template = getTemplateById("promocao");
    const combo = getColorComboById(template.defaultColorComboId);

    expect(state.formatId).toBe("quadrado");
    expect(state.templateId).toBe("promocao");
    expect(state.texts.heading.value).toBe(template.slots.heading.defaultValue);
    expect(state.backgroundColor).toBe(combo.background);
    expect(state.badgeBackground).toBe(combo.badgeBackground);
  });

  it("um badge desabilitado por padrão começa vazio (não aparece na arte)", () => {
    const state = createInitialEditorState("restaurante");
    expect(state.texts.badge.value).toBe("");
    expect(isSlotVisible(state, "badge")).toBe(false);
  });

  it("um badge habilitado por padrão começa preenchido", () => {
    const state = createInitialEditorState("promocao");
    expect(state.texts.badge.value.length).toBeGreaterThan(0);
    expect(isSlotVisible(state, "badge")).toBe(true);
  });
});

describe("updateTextValue / updateTextStyle", () => {
  it("atualiza apenas o texto do slot informado, sem afetar os demais", () => {
    const state = createInitialEditorState("promocao");
    const next = updateTextValue(state, "heading", "Novo título");

    expect(next.texts.heading.value).toBe("Novo título");
    expect(next.texts.body.value).toBe(state.texts.body.value);
  });

  it("atualiza estilo (fonte, alinhamento, negrito) sem alterar o texto", () => {
    const state = createInitialEditorState("promocao");
    const next = updateTextStyle(state, "heading", { align: "left", bold: true });

    expect(next.texts.heading.align).toBe("left");
    expect(next.texts.heading.bold).toBe(true);
    expect(next.texts.heading.value).toBe(state.texts.heading.value);
  });
});

describe("updateTextOffset (arrastar texto)", () => {
  it("limita o deslocamento para não deixar o texto sair da área da arte", () => {
    const state = createInitialEditorState("promocao");
    const next = updateTextOffset(state, "heading", 10, -10);

    expect(Math.abs(next.texts.heading.offsetXFrac)).toBeLessThanOrEqual(0.32);
    expect(Math.abs(next.texts.heading.offsetYFrac)).toBeLessThanOrEqual(0.32);
  });
});

describe("applyTemplateToState (troca de template preserva conteúdo do usuário)", () => {
  it("mantém um texto que o usuário editou manualmente", () => {
    const withCustomHeading = updateTextValue(createInitialEditorState("promocao"), "heading", "Texto do usuário");
    const afterSwitch = applyTemplateToState(withCustomHeading, "restaurante");

    expect(afterSwitch.texts.heading.value).toBe("Texto do usuário");
  });

  it("substitui pelo novo padrão um texto que ainda não tinha sido editado", () => {
    const initial = createInitialEditorState("promocao");
    const afterSwitch = applyTemplateToState(initial, "aniversario");

    expect(afterSwitch.texts.heading.value).toBe(getTemplateById("aniversario").slots.heading.defaultValue);
  });

  it("preserva a imagem de fundo enviada pelo usuário", () => {
    const withImage = setBackgroundImage(createInitialEditorState("promocao"), {
      url: "blob:test-url",
      fileName: "foto.png",
      naturalWidth: 800,
      naturalHeight: 600,
    });
    const afterSwitch = applyTemplateToState(withImage, "restaurante");

    expect(afterSwitch.backgroundImage.url).toBe("blob:test-url");
  });

  it("reinicia o deslocamento manual (arraste) ao trocar de template", () => {
    const dragged = updateTextOffset(createInitialEditorState("promocao"), "heading", 0.1, 0.1);
    const afterSwitch = applyTemplateToState(dragged, "restaurante");

    expect(afterSwitch.texts.heading.offsetXFrac).toBe(0);
    expect(afterSwitch.texts.heading.offsetYFrac).toBe(0);
  });

  it("não troca as cores quando o usuário já tinha personalizado manualmente", () => {
    const customColor = setBackgroundColor(createInitialEditorState("promocao"), "#123456");
    const afterSwitch = applyTemplateToState(customColor, "restaurante");

    expect(afterSwitch.backgroundColor).toBe("#123456");
    expect(afterSwitch.colorComboId).toBeNull();
  });

  it("não faz nada quando o template de destino é o mesmo já ativo", () => {
    const state = createInitialEditorState("promocao");
    expect(applyTemplateToState(state, "promocao")).toBe(state);
  });
});

describe("applyColorComboToState / setBackgroundColor / setBadgeColors", () => {
  it("aplica uma combinação de cores pronta a todos os textos", () => {
    const state = createInitialEditorState("promocao");
    const next = applyColorComboToState(state, "midnight");
    const combo = getColorComboById("midnight");

    expect(next.colorComboId).toBe("midnight");
    expect(next.backgroundColor).toBe(combo.background);
    expect(next.texts.heading.color).toBe(combo.heading);
  });

  it("cor de fundo personalizada marca colorComboId como null", () => {
    const state = createInitialEditorState("promocao");
    const next = setBackgroundColor(state, "#abcdef");

    expect(next.backgroundColor).toBe("#abcdef");
    expect(next.colorComboId).toBeNull();
  });

  it("cores do selo podem ser personalizadas independentemente", () => {
    const state = createInitialEditorState("promocao");
    const next = setBadgeColors(state, "#111111", "#eeeeee");

    expect(next.badgeBackground).toBe("#111111");
    expect(next.badgeTextColor).toBe("#eeeeee");
  });
});

describe("imagem de fundo", () => {
  it("setBackgroundImage grava a imagem e clearBackgroundImage remove", () => {
    const state = createInitialEditorState("promocao");
    const withImage = setBackgroundImage(state, {
      url: "blob:abc",
      fileName: "foto.jpg",
      naturalWidth: 1200,
      naturalHeight: 800,
    });

    expect(withImage.backgroundImage.url).toBe("blob:abc");
    expect(withImage.backgroundImage.fileName).toBe("foto.jpg");

    const cleared = clearBackgroundImage(withImage);
    expect(cleared.backgroundImage.url).toBeNull();
  });

  it("setBackgroundImageFocus fica sempre entre 0 e 1", () => {
    const state = createInitialEditorState("promocao");
    const next = setBackgroundImageFocus(state, 2, -1);

    expect(next.backgroundImage.focusXFrac).toBe(1);
    expect(next.backgroundImage.focusYFrac).toBe(0);
  });
});

describe("setFormat", () => {
  it("troca o formato sem alterar o restante do estado", () => {
    const state = createInitialEditorState("promocao", "quadrado");
    const next = setFormat(state, "stories");

    expect(next.formatId).toBe("stories");
    expect(next.templateId).toBe(state.templateId);
    expect(next.texts).toEqual(state.texts);
  });
});

describe("isSlotVisible", () => {
  it("considera um slot invisível quando o valor é vazio ou só espaços", () => {
    const state = updateTextValue(createInitialEditorState("promocao"), "body", "   ");
    expect(isSlotVisible(state, "body")).toBe(false);
  });
});
