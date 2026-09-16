import { describe, expect, it } from "vitest";
import { categories } from "@/data/categories";
import { tools } from "@/data/tools";

/**
 * Testes de integridade do catálogo central. Protegem contra regressões ao
 * adicionar novas ferramentas ou categorias (PROMPT MESTRE, seção 16):
 * um slug duplicado ou uma referência quebrada quebraria silenciosamente a
 * navegação e o SEO do site.
 */
describe("catálogo de categorias e ferramentas", () => {
  it("toda categoria tem um id único", () => {
    const ids = categories.map((category) => category.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("toda ferramenta pertence a uma categoria existente", () => {
    const categoryIds = new Set(categories.map((category) => category.id));
    for (const tool of tools) {
      expect(categoryIds.has(tool.category)).toBe(true);
    }
  });

  it("o slug de cada ferramenta é único dentro da sua categoria", () => {
    const seen = new Set<string>();
    for (const tool of tools) {
      const key = `${tool.category}/${tool.slug}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("o id de cada ferramenta é único no catálogo", () => {
    const ids = tools.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("toda ferramenta relacionada existe no catálogo", () => {
    const knownIds = new Set(tools.map((tool) => tool.id));
    for (const tool of tools) {
      for (const relatedId of tool.relatedTools) {
        expect(knownIds.has(relatedId)).toBe(true);
      }
    }
  });

  it("nenhuma ferramenta se relaciona com ela mesma", () => {
    for (const tool of tools) {
      expect(tool.relatedTools).not.toContain(tool.id);
    }
  });
});
