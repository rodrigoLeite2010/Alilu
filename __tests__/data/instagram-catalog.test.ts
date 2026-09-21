import { describe, expect, it } from "vitest";
import { INSTAGRAM_CATEGORY, instagramTools, plannedInstagramTools, getInstagramToolByPath } from "@/data/instagram";

describe("catálogo da categoria Instagram", () => {
  it("a categoria vive em /instagram", () => {
    expect(INSTAGRAM_CATEGORY.path).toBe("/instagram");
  });

  it("toda ferramenta publicada tem um id e um path únicos, dentro de /instagram", () => {
    const ids = instagramTools.map((tool) => tool.id);
    const paths = instagramTools.map((tool) => tool.path);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) {
      expect(path.startsWith("/instagram")).toBe(true);
    }
  });

  it("inclui o Criador de Posts, publicado (status ativo)", () => {
    const tool = getInstagramToolByPath("/instagram/criar-post");
    expect(tool).toBeDefined();
    expect(tool?.status).toBe("ativo");
  });

  it("inclui o Criador de Carrosséis, publicado (status ativo) — Fase 2", () => {
    const tool = getInstagramToolByPath("/instagram/carrossel");
    expect(tool).toBeDefined();
    expect(tool?.status).toBe("ativo");
    expect(tool?.id).toBe("criador-carrossel-instagram");
  });

  it("getInstagramToolByPath retorna undefined para um caminho inexistente", () => {
    expect(getInstagramToolByPath("/instagram/nao-existe")).toBeUndefined();
  });

  it("ferramentas planejadas (roadmap) não têm nenhum campo de link — nunca viram cards clicáveis", () => {
    for (const planned of plannedInstagramTools) {
      expect(planned).not.toHaveProperty("path");
      expect(planned).not.toHaveProperty("href");
      expect(planned.name.length).toBeGreaterThan(0);
      expect(planned.description.length).toBeGreaterThan(0);
    }
  });

  it("nenhuma ferramenta planejada duplica o nome de uma ferramenta já publicada", () => {
    const publishedNames = new Set(instagramTools.map((tool) => tool.name));
    for (const planned of plannedInstagramTools) {
      expect(publishedNames.has(planned.name)).toBe(false);
    }
  });

  it("inclui o Gerador de Legendas, publicado (status ativo) — Fase 2", () => {
    const tool = getInstagramToolByPath("/instagram/legendas");
    expect(tool).toBeDefined();
    expect(tool?.status).toBe("ativo");
    expect(tool?.id).toBe("gerador-legendas-instagram");
  });

  it("Criador de Carrosséis e Gerador de Legendas não aparecem mais no roadmap, já que foram publicados", () => {
    const plannedNames = plannedInstagramTools.map((tool) => tool.name);
    expect(plannedNames).not.toContain("Criador de Carrosséis");
    expect(plannedNames).not.toContain("Gerador de Legendas");
  });
});
