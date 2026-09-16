import { describe, expect, it } from "vitest";
import { getPublishedTools, getToolRobotsMeta, isToolPublished } from "@/lib/seo/publish";
import { buildPageMetadata } from "@/lib/seo/metadata";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { categories, getCategoryById } from "@/data/categories";
import { getToolBySlug, getToolsByCategory, tools, type Tool } from "@/data/tools";
import { SITE_URL } from "@/lib/seo/site";
import { toolComponents } from "@/components/tools/tool-registry";
import { toolContent } from "@/components/tools/tool-content";

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

describe("G) Gerador de Recibo (ETAPA 2) — primeira ferramenta ativa", () => {
  const receipt = getToolBySlug("empresa", "gerador-recibo");

  it("está com status ativo no catálogo", () => {
    expect(receipt?.status).toBe("ativo");
  });

  it("permite indexação (index: true, follow: true)", () => {
    expect(receipt).toBeDefined();
    expect(getToolRobotsMeta(receipt!)).toEqual({ index: true, follow: true });
  });

  it("aparece no sitemap", () => {
    const entries = sitemap();
    const url = `${SITE_URL}/utilitarios/empresa/gerador-recibo`;
    expect(entries.some((entry) => entry.url === url)).toBe(true);
  });

  it("uma ferramenta em-breve do catálogo continua com noindex e fora do sitemap", () => {
    const stillComingSoon = tools.find((tool) => tool.status === "em-breve");
    expect(stillComingSoon).toBeDefined();
    expect(getToolRobotsMeta(stillComingSoon!)).toEqual({
      index: false,
      follow: true,
    });

    const entries = sitemap();
    const url = `${SITE_URL}/utilitarios/${stillComingSoon!.category}/${stillComingSoon!.slug}`;
    expect(entries.some((entry) => entry.url === url)).toBe(false);
  });
});

describe("H) Calculadora de Juros Compostos (ETAPA 3) — segunda ferramenta ativa", () => {
  const compoundInterest = getToolBySlug("financeiro", "juros-compostos");

  it("está com status ativo no catálogo", () => {
    expect(compoundInterest?.status).toBe("ativo");
  });

  it("permite indexação (index: true, follow: true)", () => {
    expect(compoundInterest).toBeDefined();
    expect(getToolRobotsMeta(compoundInterest!)).toEqual({ index: true, follow: true });
  });

  it("aparece no sitemap", () => {
    const entries = sitemap();
    const url = `${SITE_URL}/utilitarios/financeiro/juros-compostos`;
    expect(entries.some((entry) => entry.url === url)).toBe(true);
  });

  it("o Gerador de Recibo (ETAPA 2) continua ativo e indexável (regressão)", () => {
    const receipt = getToolBySlug("empresa", "gerador-recibo");
    expect(receipt?.status).toBe("ativo");
    expect(getToolRobotsMeta(receipt!)).toEqual({ index: true, follow: true });
  });
});

describe("I) Simulador de Financiamento SAC x Price (ETAPA 4) — terceira ferramenta ativa", () => {
  const financing = getToolBySlug("financeiro", "financiamento-sac-price");

  it("está com status ativo no catálogo", () => {
    expect(financing?.status).toBe("ativo");
  });

  it("permite indexação (index: true, follow: true)", () => {
    expect(financing).toBeDefined();
    expect(getToolRobotsMeta(financing!)).toEqual({ index: true, follow: true });
  });

  it("aparece no sitemap", () => {
    const entries = sitemap();
    const url = `${SITE_URL}/utilitarios/financeiro/financiamento-sac-price`;
    expect(entries.some((entry) => entry.url === url)).toBe(true);
  });

  it("o financiamento de veículo continua em-breve (não foi implementado nesta etapa)", () => {
    const financiamentoVeiculo = getToolBySlug("financeiro", "financiamento-veiculo");
    expect(financiamentoVeiculo?.status).toBe("em-breve");
    expect(getToolRobotsMeta(financiamentoVeiculo!)).toEqual({
      index: false,
      follow: true,
    });
  });

  it("o Gerador de Recibo e a Calculadora de Juros Compostos continuam ativos (regressão)", () => {
    const receipt = getToolBySlug("empresa", "gerador-recibo");
    const compoundInterest = getToolBySlug("financeiro", "juros-compostos");
    expect(receipt?.status).toBe("ativo");
    expect(compoundInterest?.status).toBe("ativo");
  });

  it("está registrada em tool-registry/tool-content pela chave correta (tool.id)", () => {
    // Regressão da correção pré-commit da ETAPA 4: o registro estava
    // indexado pelo slug ("financiamento-sac-price") em vez de tool.id
    // ("sac-x-price"), que é a chave que a página real
    // (app/utilitarios/[categoria]/[ferramenta]/page.tsx) usa para buscar o
    // componente e o conteúdo — a ferramenta ficava "ativa" e indexável,
    // mas exibia o aviso "Em breve" em vez da calculadora.
    expect(financing).toBeDefined();
    expect(toolComponents[financing!.id]).toBeDefined();
    expect(toolContent[financing!.id]).toBeDefined();
  });
});

describe("J) toda ferramenta ativa tem componente e conteúdo registrados por tool.id", () => {
  // Verificação geral (não específica de uma etapa): a página real
  // (app/utilitarios/[categoria]/[ferramenta]/page.tsx) busca o componente
  // e o conteúdo de uma ferramenta por `tool.id`, não por `tool.slug`. Uma
  // ferramenta "ativa" sem essa chave correta fica indexável no sitemap,
  // mas mostra o aviso genérico "Em breve" em vez da calculadora real — o
  // exato bug encontrado pela auditoria da ETAPA 4. Este teste garante que
  // isso nunca passe despercebido para nenhuma ferramenta ativa, presente
  // ou futura.
  const activeTools = tools.filter((tool) => tool.status === "ativo");

  it("existe pelo menos uma ferramenta ativa (checagem de sanidade do próprio teste)", () => {
    expect(activeTools.length).toBeGreaterThan(0);
  });

  it.each(activeTools.map((tool) => [tool.id, tool] as const))(
    "%s possui componente registrado em tool-registry.tsx pela chave tool.id",
    (id) => {
      expect(toolComponents[id]).toBeDefined();
    }
  );

  it.each(activeTools.map((tool) => [tool.id, tool] as const))(
    "%s possui conteúdo/FAQ registrado em tool-content.tsx pela chave tool.id",
    (id) => {
      expect(toolContent[id]).toBeDefined();
    }
  );
});
