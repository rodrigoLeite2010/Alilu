import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/seo/site";
import { INSTAGRAM_CATEGORY, instagramTools } from "@/data/instagram";
import { metadata as categoryMetadata } from "@/app/instagram/page";
import { metadata as postToolMetadata } from "@/app/instagram/criar-post/page";
import { metadata as carouselToolMetadata } from "@/app/instagram/carrossel/page";
import { metadata as captionToolMetadata } from "@/app/instagram/legendas/page";

describe("SEO da categoria Instagram", () => {
  it("o sitemap inclui a página da categoria, o Criador de Posts, o Criador de Carrosséis e o Gerador de Legendas", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls).toContain(`${SITE_URL}${INSTAGRAM_CATEGORY.path}`);
    expect(urls).toContain(`${SITE_URL}/instagram/criar-post`);
    expect(urls).toContain(`${SITE_URL}/instagram/carrossel`);
    expect(urls).toContain(`${SITE_URL}/instagram/legendas`);
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

  it("a página da categoria destaca criar, agendar e publicar no title e na description", () => {
    expect(categoryMetadata.title).toBe("Criar, Agendar e Publicar Posts no Instagram Grátis | ALILU");
    expect(categoryMetadata.description).toContain("carrosséis");
    expect(categoryMetadata.description).toContain("agendar");
    expect(String(categoryMetadata.description).length).toBeLessThanOrEqual(160);
    expect(categoryMetadata.alternates?.canonical).toBe(`${SITE_URL}/instagram`);
  });

  it("a página do Criador de Posts usa o title e a description definidos no PROMPT (Fase 1)", () => {
    expect(postToolMetadata.title).toBe("Criar Post para Instagram Grátis Online | ALILU");
    expect(postToolMetadata.description).toBe(
      "Crie posts para Instagram grátis: escolha modelos, personalize textos, cores e fotos e baixe em PNG ou JPG — ou publique e agende direto no Instagram."
    );
    expect(postToolMetadata.alternates?.canonical).toBe(`${SITE_URL}/instagram/criar-post`);
  });

  it("a página do Criador de Carrosséis usa o title e a description definidos no PROMPT (Fase 2, ETAPA 13)", () => {
    expect(carouselToolMetadata.title).toBe("Criar Carrossel para Instagram Grátis Online | ALILU");
    expect(carouselToolMetadata.description).toBe(
      "Crie carrosséis para Instagram grátis: edite slides, organize a sequência e baixe em ZIP — ou conecte sua conta para publicar ou agendar."
    );
    expect(carouselToolMetadata.alternates?.canonical).toBe(`${SITE_URL}/instagram/carrossel`);
  });

  it("a página do Gerador de Legendas usa o title e a description definidos no PROMPT (Fase 2, ETAPA 13)", () => {
    expect(captionToolMetadata.title).toBe("Gerador de Legendas para Instagram Grátis | ALILU");
    expect(captionToolMetadata.description).toBe(
      "Crie legendas para Instagram gratuitamente. Escolha modelos, personalize o estilo e copie textos prontos para editar."
    );
    expect(captionToolMetadata.alternates?.canonical).toBe(`${SITE_URL}/instagram/legendas`);
  });
});
