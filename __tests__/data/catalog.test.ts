import { describe, expect, it } from "vitest";
import { categories } from "@/data/categories";
import { getFeaturedTools, getToolsByCategory, tools } from "@/data/tools";

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

  it("mantém os destaques editoriais na ordem definida", () => {
    expect(getFeaturedTools().map((tool) => tool.id)).toEqual([
      "gerador-cpf",
      "gerador-cnpj",
    ]);
  });

  it("mantém CPF e CNPJ no início da categoria de geradores", () => {
    expect(getToolsByCategory("geradores").slice(0, 2).map((tool) => tool.id)).toEqual([
      "gerador-cpf",
      "gerador-cnpj",
    ]);
  });

  it("inclui a categoria PDF com a ferramenta Unir PDFs publicada", () => {
    const pdfCategory = categories.find((category) => category.id === "pdf");
    const mergeTool = tools.find((tool) => tool.id === "unir-pdf");

    expect(pdfCategory).toMatchObject({ name: "PDF", icon: "file-pdf" });
    expect(mergeTool).toMatchObject({
      category: "pdf",
      slug: "unir-pdf",
      status: "ativo",
      pageDescription:
        "Combine dois ou mais arquivos PDF em um único documento. Organize a ordem das páginas e baixe seu arquivo gratuitamente.",
      metaDescription:
        "Una dois ou mais arquivos PDF online e grátis. Organize seus documentos na ordem desejada e baixe um único PDF, sem instalar programas.",
    });
  });

  it("mantém todas as 18 ferramentas PDF no catálogo e só publica as implementadas", () => {
    const pdfTools = getToolsByCategory("pdf");

    expect(pdfTools).toHaveLength(18);
    expect(pdfTools.filter((tool) => tool.status === "ativo").map((tool) => tool.id).sort()).toEqual([
      "dividir-pdf",
      "girar-pdf",
      "jpg-para-pdf",
      "marca-dagua",
      "pdf-para-jpg",
      "unir-pdf",
    ]);
    expect(pdfTools.filter((tool) => tool.status === "em-breve")).toHaveLength(12);
  });
});
