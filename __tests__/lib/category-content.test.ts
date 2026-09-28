import { describe, expect, it } from "vitest";
import { categories } from "@/data/categories";
import { getToolsByIds, tools } from "@/data/tools";
import { categoryContent } from "@/components/categories/category-content";

/**
 * Integridade do texto introdutório e dos destaques dos hubs de categoria
 * (app/utilitarios/[categoria]/page.tsx). Uma referência quebrada aqui
 * quebraria silenciosamente a página (highlight sem ferramenta correspondente).
 */
describe("categoryContent", () => {
  it("toda categoria do catálogo tem uma entrada de conteúdo", () => {
    for (const category of categories) {
      expect(categoryContent[category.id]).toBeDefined();
    }
  });

  it("toda categoria tem uma introdução com texto real (não vazia, não genérica demais)", () => {
    for (const category of categories) {
      const { intro } = categoryContent[category.id];
      expect(intro.length).toBeGreaterThan(120);
    }
  });

  it("todo highlight aponta para uma ferramenta que existe e pertence à própria categoria", () => {
    for (const category of categories) {
      const { highlights } = categoryContent[category.id];
      expect(highlights.length).toBeGreaterThanOrEqual(2);

      const resolved = getToolsByIds(highlights.map((h) => h.toolId));
      expect(resolved).toHaveLength(highlights.length);

      for (const tool of resolved) {
        expect(tool.category).toBe(category.id);
      }
    }
  });

  it("todo highlight tem uma razão específica (não vazia)", () => {
    for (const category of categories) {
      for (const highlight of categoryContent[category.id].highlights) {
        expect(highlight.reason.length).toBeGreaterThan(20);
      }
    }
  });

  it("nenhuma ferramenta ativa fica órfã de categoria conhecida (checagem de sanidade)", () => {
    const categoryIds = new Set(categories.map((c) => c.id));
    for (const tool of tools) {
      expect(categoryIds.has(tool.category)).toBe(true);
    }
  });
});
