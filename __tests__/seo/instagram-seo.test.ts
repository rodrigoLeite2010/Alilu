import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/seo/site";
import { INSTAGRAM_CATEGORY, instagramTools } from "@/data/instagram";
import { metadata as categoryMetadata } from "@/app/instagram/page";
import { metadata as toolMetadata } from "@/app/instagram/criar-post/page";

describe("SEO da categoria Instagram", () => {
  it("o sitemap inclui a página da categoria e a do Criador de Posts", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toContain(`${SITE_URL}${INSTAGRAM_CATEGORY.path}`);
    expect(urls).toContain(`${SITE_URL}/instagram/criar-post`);
  });

  it("nenhuma URL do sitemap se repete depois de somar as rotas do Instagram", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("o sitemap nunca listaria uma ferramenta Instagram com status em-breve (regra futura)", () => {
    const urls = sitemap().map((entry) => entry.url);
    const notYetActiveUrls = instagramTools
      .filter((tool) => tool.status !== "ativo")
      .map((tool) => `${SITE_URL}${tool.path}`);

    for (const url of notYetActiveUrls) {
      expect(urls).not.toContain(url);
    }
  });

  it("a página da categoria usa o title e a description definidos no PROMPT (ETAPA 8)", () => {
    expect(categoryMetadata.title).toBe("Ferramentas para Instagram Grátis | ALILU");
    expect(categoryMetadata.description).toBe(
      "Crie posts e imagens para Instagram gratuitamente. Personalize modelos, edite textos e prepare conteúdos para suas redes sociais."
    );
    expect(categoryMetadata.alternates?.canonical).toBe(`${SITE_URL}/instagram`);
  });

  it("a página do Criador de Posts usa o title e a description definidos no PROMPT (ETAPA 8)", () => {
    expect(toolMetadata.title).toBe("Criar Post para Instagram Grátis Online | ALILU");
    expect(toolMetadata.description).toBe(
      "Crie posts para Instagram gratuitamente. Escolha modelos, personalize textos, cores e fotos e baixe suas imagens em PNG ou JPG."
    );
    expect(toolMetadata.alternates?.canonical).toBe(`${SITE_URL}/instagram/criar-post`);
  });
});
