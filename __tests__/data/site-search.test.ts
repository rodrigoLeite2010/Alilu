import { describe, expect, it } from "vitest";
import { getSiteSearchIndex } from "@/data/site-search";
import { tools } from "@/data/tools";
import { instagramTools } from "@/data/instagram";
import { lotteryModalities } from "@/data/lotteries";
import { videoTools } from "@/data/videos";
import { travelTools } from "@/data/viagens";

/**
 * Testes de integridade do índice de busca da Home (components/home/HomeSearch.tsx):
 * protege contra hrefs quebrados e contra itens duplicados quando o catálogo
 * crescer.
 */
describe("índice de busca da Home", () => {
  it("combina os catálogos de ferramentas, Instagram, Loterias, Vídeos, Viagens e o portal Imóveis", () => {
    const index = getSiteSearchIndex();
    const activeTools = tools.filter((tool) => tool.status === "ativo");
    const activeInstagramTools = instagramTools.filter((tool) => tool.status === "ativo");
    const activeLotteryModalities = lotteryModalities.filter((modality) => modality.status === "ativo");
    const activeVideoTools = videoTools.filter((tool) => tool.status === "ativo");

    expect(index).toHaveLength(
      activeTools.length + activeInstagramTools.length + activeLotteryModalities.length + activeVideoTools.length + travelTools.length + 1,
    );
  });
  it("encontra o portal de imóveis na busca da Home",()=>{
    expect(getSiteSearchIndex().find(i=>i.id==="category:imoveis")).toMatchObject({href:"/imoveis",categoryLabel:"Imóveis",keywords:expect.arrayContaining(["aluguel","venda"])});
  });

  it("cada item tem um id único no índice", () => {
    const ids = getSiteSearchIndex().map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo item de ferramenta aponta para /utilitarios/[categoria]/[slug]", () => {
    const toolItems = getSiteSearchIndex().filter((item) => item.id.startsWith("tool:"));
    for (const item of toolItems) {
      expect(item.href).toMatch(/^\/utilitarios\/[a-z0-9-]+\/[a-z0-9-]+$/);
    }
  });

  it("todo item de Instagram aponta para uma rota dentro de /instagram", () => {
    const instagramItems = getSiteSearchIndex().filter((item) => item.id.startsWith("instagram:"));
    expect(instagramItems.length).toBeGreaterThan(0);
    for (const item of instagramItems) {
      expect(item.href.startsWith("/instagram")).toBe(true);
      expect(item.categoryLabel).toBe("Instagram");
    }
  });

  it("todo item de Loterias aponta para uma rota dentro de /loterias", () => {
    const lotteryItems = getSiteSearchIndex().filter((item) => item.id.startsWith("lottery:"));
    expect(lotteryItems.length).toBeGreaterThan(0);
    for (const item of lotteryItems) {
      expect(item.href.startsWith("/loterias")).toBe(true);
      expect(item.categoryLabel).toBe("Loterias");
    }
  });

  it("todo item de Vídeos aponta para uma rota dentro de /videos", () => {
    const videoItems = getSiteSearchIndex().filter((item) => item.id.startsWith("video:"));
    expect(videoItems.length).toBeGreaterThan(0);
    for (const item of videoItems) {
      expect(item.href.startsWith("/videos")).toBe(true);
      expect(item.categoryLabel).toBe("Vídeos");
    }
  });

  it("não inclui ferramentas com status em-breve", () => {
    const index = getSiteSearchIndex();
    const hasUnpublished = index.some((item) => {
      const originalTool = tools.find((tool) => `tool:${tool.id}` === item.id);
      return originalTool?.status === "em-breve";
    });
    expect(hasUnpublished).toBe(false);
  });
});
