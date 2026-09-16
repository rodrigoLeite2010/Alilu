import { describe, expect, it } from "vitest";
import { getPublishedTools, getToolRobotsMeta, isToolPublished } from "@/lib/seo/publish";
import { buildPageMetadata } from "@/lib/seo/metadata";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { categories, getCategoryById } from "@/data/categories";
import { getToolBySlug, getToolsByCategory, tools, type Tool } from "@/data/tools";
import { SITE_URL } from "@/lib/seo/site";

/**
 * Testes de comportamento da regra central de SEO "em-breve" x "ativo"
 * (ver lib/seo/publish.ts). O objetivo é comprovar o COMPORTAMENTO esperado
 * (o que o buscador veria), não apenas a implementação interna — por isso os
 * testes exercitam sitemap(), robots() e buildPageMetadata() de ponta a
 * ponta, além das funções puras.
 */

const emBreveTool: Pick<Tool, "status"> = { status: "em-breve" };
const ativoTool: Pick<Tool, "status"> = { status: "ativo" };

describe("A) ferramenta em-breve não aparece no sitemap", () => {
  it("getPublishedTools remove ferramentas em-breve", () => {
    const fixture: Pick<Tool, "status">[] = [emBreveTool, ativoTool];
    expect(getPublishedTools(fixture)).toEqual([ativoTool]);
  });

  it("o sitemap real não contém nenhuma ferramenta em-breve do catálogo atual", () => {
    const entries = sitemap();
    const emBreveUrls = tools
      .filter((tool) => tool.status === "em-breve")
      .map((tool) => `${SITE_URL}/utilitarios/${tool.category}/${tool.slug}`);

    for (const url of emBreveUrls) {
      expect(entries.some((entry) => entry.url === url)).toBe(false);
    }
  });
});

describe("B) ferramenta ativo aparece no sitemap", () => {
  it("getPublishedTools mantém ferramentas ativas", () => {
    const fixture: Pick<Tool, "status">[] = [emBreveTool, ativoTool];
    expect(getPublishedTools(fixture)).toContainEqual(ativoTool);
  });

  it("o sitemap real contém exatamente as ferramentas com status ativo do catálogo", () => {
    const entries = sitemap();
    const expectedActiveUrls = tools
      .filter(isToolPublished)
      .map((tool) => `${SITE_URL}/utilitarios/${tool.category}/${tool.slug}`);

    const sitemapToolUrls = entries.filter((entry) =>
      entry.url.includes("/utilitarios/") &&
      entry.url.split("/utilitarios/")[1]?.includes("/")
    );

    expect(sitemapToolUrls.map((entry) => entry.url).sort()).toEqual(
      expectedActiveUrls.sort()
    );
  });
});

describe("C) metadata de ferramenta em-breve possui noindex", () => {
  it("getToolRobotsMeta retorna index: false para em-breve", () => {
    expect(getToolRobotsMeta(emBreveTool)).toEqual({ index: false, follow: true });
  });

  it("buildPageMetadata propaga o noindex para o objeto Metadata final", () => {
    const metadata = buildPageMetadata({
      title: "Ferramenta em teste",
      description: "Descrição de teste",
      path: "/utilitarios/outros/ferramenta-teste",
      robots: getToolRobotsMeta(emBreveTool),
    });

    expect(metadata.robots).toEqual({ index: false, follow: true });
  });
});

describe("D) metadata de ferramenta ativo permite indexação", () => {
  it("getToolRobotsMeta retorna index: true para ativo", () => {
    expect(getToolRobotsMeta(ativoTool)).toEqual({ index: true, follow: true });
  });

  it("buildPageMetadata propaga a permissão de indexação", () => {
    const metadata = buildPageMetadata({
      title: "Ferramenta em teste",
      description: "Descrição de teste",
      path: "/utilitarios/outros/ferramenta-teste",
      robots: getToolRobotsMeta(ativoTool),
    });

    expect(metadata.robots).toEqual({ index: true, follow: true });
  });

  it("canonical e Open Graph continuam presentes independente do status", () => {
    const metadata = buildPageMetadata({
      title: "Ferramenta em teste",
      description: "Descrição de teste",
      path: "/utilitarios/outros/ferramenta-teste",
      robots: getToolRobotsMeta(ativoTool),
    });

    expect(metadata.alternates?.canonical).toBe("/utilitarios/outros/ferramenta-teste");
    expect(metadata.openGraph).toBeDefined();
  });
});

describe("E) robots.txt continua correto", () => {
  it("permite todos os agentes e aponta para o sitemap correto", () => {
    const result = robots();
    expect(result.rules).toEqual({ userAgent: "*", allow: "/" });
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});

describe("F) rotas principais continuam funcionando (integridade dos dados que as alimentam)", () => {
  it("toda categoria listada é resolvida por getCategoryById", () => {
    for (const category of categories) {
      expect(getCategoryById(category.id)).toEqual(category);
    }
  });

  it("toda ferramenta é resolvida por getToolBySlug a partir de categoria+slug", () => {
    for (const tool of tools) {
      expect(getToolBySlug(tool.category, tool.slug)).toEqual(tool);
    }
  });

  it("getToolsByCategory nunca lança erro e retorna um array para cada categoria", () => {
    for (const category of categories) {
      expect(Array.isArray(getToolsByCategory(category.id))).toBe(true);
    }
  });

  // A verificação completa das rotas HTTP (/, /utilitarios, categorias,
  // ferramentas, páginas legais) é feita via `next build` + smoke test
  // manual, documentado no relatório desta auditoria.
});
