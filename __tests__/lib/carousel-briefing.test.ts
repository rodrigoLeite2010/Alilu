import { describe, expect, it } from "vitest";
import { extractBriefingThemes, pickBriefingTheme } from "@/lib/content-automation/smart-carousel/briefing";
import { buildGenerationDirective } from "@/lib/content-automation/smart-carousel/directive";
import { planCarousel } from "@/lib/content-automation/smart-carousel/planner";
import { DEFAULT_SMART_CAROUSEL_CONFIG } from "@/lib/content-automation/smart-carousel/config";

const PRESTADOR =
  "Crie diariamente uma postagem original, envolvente e persuasiva para o Instagram do Prestador Seguro. A cada dia da semana, explore um tema diferente: riscos de contratar desconhecidos, histórias do cotidiano, curiosidades sobre recomendações, segurança nos condomínios, erros ao contratar, vantagens de profissionais indicados e valorização de bons prestadores. Use gatilhos de curiosidade, emoção, confiança e identificação. Apresente o Prestador Seguro como uma plataforma que conecta moradores a profissionais recomendados. Não invente dados ou funcionalidades. Finalize com um convite para conhecer a plataforma e seguir o perfil. Use hashtags relevantes.";

describe("briefing do prompt (assuntos da empresa do usuário)", () => {
  it("extrai a lista de assuntos depois de ':'", () => {
    expect(extractBriefingThemes(PRESTADOR)).toEqual([
      "riscos de contratar desconhecidos",
      "histórias do cotidiano",
      "curiosidades sobre recomendações",
      "segurança nos condomínios",
      "erros ao contratar",
      "vantagens de profissionais indicados",
      "valorização de bons prestadores",
    ]);
  });

  it("aceita tópicos em linhas e ignora prompt de estilo sem lista", () => {
    expect(extractBriefingThemes("Temas:\n- dicas de casa\n- reformas\n- segurança")).toEqual(["dicas de casa", "reformas", "segurança"]);
    expect(extractBriefingThemes("Crie carrosséis para a Alilu com autoridade. Alterne temas de psicologia, dinheiro e família.")).toEqual([]);
    expect(extractBriefingThemes("")).toEqual([]);
  });

  it("não repete assuntos recentes e é determinístico pela semente", () => {
    const themes = extractBriefingThemes(PRESTADOR);
    const recent = themes.slice(0, 6);
    expect(pickBriefingTheme(themes, recent, "x")).toBe("valorização de bons prestadores");
    expect(pickBriefingTheme(themes, [], "seed-1")).toBe(pickBriefingTheme(themes, [], "seed-1"));
    expect(pickBriefingTheme([], [], "s")).toBeNull();
  });

  it("diretiva: prompt é obrigatório, sem categoria sorteada, sem convite da Alilu", () => {
    const plan = { ...planCarousel({ config: DEFAULT_SMART_CAROUSEL_CONFIG, seed: "p" }), topic: "segurança nos condomínios" };
    const directive = buildGenerationDirective({ basePrompt: PRESTADOR, plan, recentTopics: [], recentCategories: ["Família"], photos: { min: 3, max: 5, target: 4 }, topicFromPrompt: true });
    expect(directive).toContain("PROMPT DO USUÁRIO (OBRIGATÓRIO");
    expect(directive).toContain(PRESTADOR);
    expect(directive).toContain("TEMA DESTE CARROSSEL (um dos assuntos pedidos no prompt): segurança nos condomínios");
    expect(directive).not.toContain("CATEGORIA ESCOLHIDA");
    expect(directive).not.toContain("acompanhar a Alilu");
    expect(directive).toContain("Não mencione a Alilu");
  });
});
