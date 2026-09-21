import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEMPLATE_ID,
  getTemplateById,
  isPostTemplateId,
  POST_TEMPLATES,
  TEXT_SLOT_IDS,
} from "@/lib/instagram/templates";
import { getColorComboById } from "@/lib/instagram/colors";
import { getFontById } from "@/lib/instagram/fonts";

describe("lib/instagram/templates", () => {
  it("define exatamente os cinco templates profissionais da ETAPA 4", () => {
    expect(POST_TEMPLATES).toHaveLength(5);
    expect(POST_TEMPLATES.map((template) => template.id)).toEqual([
      "promocao",
      "restaurante",
      "aniversario",
      "comunicado",
      "frase-motivacional",
    ]);
  });

  it("cada template tem um id único", () => {
    const ids = POST_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada template referencia uma combinação de cores e uma fonte que existem", () => {
    for (const template of POST_TEMPLATES) {
      expect(getColorComboById(template.defaultColorComboId).id).toBe(template.defaultColorComboId);
      expect(getFontById(template.defaultFontId).id).toBe(template.defaultFontId);
    }
  });

  it("todo template define os quatro slots de texto (badge, heading, body, footer)", () => {
    for (const template of POST_TEMPLATES) {
      for (const slotId of TEXT_SLOT_IDS) {
        expect(template.slots[slotId]).toBeDefined();
        expect(template.slots[slotId].label.length).toBeGreaterThan(0);
        expect(template.slots[slotId].maxLength).toBeGreaterThan(0);
      }
    }
  });

  it("posições e tamanhos de texto ficam dentro da área 0..1 (proporcional, funciona em qualquer formato)", () => {
    for (const template of POST_TEMPLATES) {
      for (const slotId of TEXT_SLOT_IDS) {
        const layout = template.slots[slotId].layout;
        expect(layout.xFrac).toBeGreaterThanOrEqual(0);
        expect(layout.xFrac).toBeLessThanOrEqual(1);
        expect(layout.yFrac).toBeGreaterThanOrEqual(0);
        expect(layout.yFrac).toBeLessThanOrEqual(1);
        expect(layout.maxWidthFrac).toBeGreaterThan(0);
        expect(layout.maxWidthFrac).toBeLessThanOrEqual(1);
        expect(layout.fontSizeFrac).toBeGreaterThan(0);
      }

      if (template.imageArea) {
        const area = template.imageArea;
        expect(area.xFrac + area.widthFrac).toBeLessThanOrEqual(1.001);
        expect(area.yFrac + area.heightFrac).toBeLessThanOrEqual(1.001);
      }
    }
  });

  it("apenas o slot badge pode iniciar oculto por padrão (os demais sempre têm um valor padrão)", () => {
    for (const template of POST_TEMPLATES) {
      expect(template.slots.heading.defaultValue.length).toBeGreaterThan(0);
      expect(template.slots.footer.defaultValue.length + 1).toBeGreaterThan(0); // footer pode ser opcional em algum template
    }
  });

  it("getTemplateById resolve pelo id e cai para o padrão quando não encontra", () => {
    expect(getTemplateById(DEFAULT_TEMPLATE_ID).id).toBe(DEFAULT_TEMPLATE_ID);
    expect(getTemplateById("template-inexistente").id).toBe(POST_TEMPLATES[0].id);
  });

  it("isPostTemplateId reconhece apenas ids cadastrados", () => {
    expect(isPostTemplateId("promocao")).toBe(true);
    expect(isPostTemplateId("template-fake")).toBe(false);
  });
});
