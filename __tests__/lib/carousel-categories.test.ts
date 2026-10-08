// Carrossel Inteligente: categorias com pesos, planejador anti-repetição, diretiva, viés e fotos (tudo puro).
import { describe, expect, it } from "vitest";
import { CAROUSEL_CATEGORIES, CAROUSEL_CATEGORY_IDS, CLOSING_INVITES, NARRATIVE_STRUCTURES, defaultCategoryWeights } from "@/lib/content-automation/smart-carousel/categories";
import { DEFAULT_SMART_CAROUSEL_CONFIG, normalizeSmartCarouselConfig, validateSmartCarouselConfigInput } from "@/lib/content-automation/smart-carousel/config";
import { buildGenerationDirective } from "@/lib/content-automation/smart-carousel/directive";
import { formatCarouselDiagnostic } from "@/lib/content-automation/smart-carousel/diagnostics";
import { planCarousel, type PlannerHistory } from "@/lib/content-automation/smart-carousel/planner";
import { textSimilarity } from "@/lib/content-automation/smart-carousel/selection";
import { findCreatorBias } from "@/lib/carousel/editorial/theme-bias";
import { CAROUSEL_SYSTEM_PROMPT, buildCaptionPrompt, buildHooksPrompt, buildResearchPrompt, buildScriptPrompt } from "@/lib/carousel/editorial/prompts";
import { choosePhotoPositions, targetPhotoCount } from "@/lib/carousel/photos/photo-plan";

const cfg = DEFAULT_SMART_CAROUSEL_CONFIG;

/** Simula N gerações seguidas alimentando o histórico (do mais novo ao mais antigo), como o cron faz. */
function simulate(count: number, config = cfg, seedPrefix = "auto") {
  const history: PlannerHistory = { categories: [], topics: [], structures: [], invites: [] };
  const plans = [];
  for (let i = 0; i < count; i += 1) {
    const plan = planCarousel({ config, history, seed: `${seedPrefix}|${i}` });
    plans.push(plan);
    history.categories.unshift(plan.categoryId);
    history.topics.unshift(plan.topic);
    history.structures.unshift(plan.structureId);
    history.invites.unshift(plan.inviteId);
  }
  return plans;
}

describe("categorias", () => {
  it("são 19, com os pesos sugeridos, e Criação de conteúdo é só uma delas", () => {
    expect(CAROUSEL_CATEGORIES).toHaveLength(19);
    expect(CAROUSEL_CATEGORY_IDS).toHaveLength(19);
    const w = defaultCategoryWeights();
    expect(w).toMatchObject({ PSICOLOGIA: 10, DINHEIRO: 10, MOTIVACAO: 10, COMPORTAMENTO: 10, FAMILIA: 10, RELACIONAMENTOS: 7, AMIZADE: 7, PERDAO: 6, SUPERACAO: 8, TRABALHO: 6, DISCIPLINA: 6, AUTOESTIMA: 6, FE: 6, EMPATIA: 6, VIDA: 8, CURIOSIDADES: 10, HISTORIAS: 8, TECNOLOGIA: 4, CRIACAO_CONTEUDO: 5 });
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    expect(w.CRIACAO_CONTEUDO / total).toBeLessThan(0.05);
  });
  it("todo banco de temas é grande o bastante e sem instrução de 'criar carrossel'", () => {
    for (const category of CAROUSEL_CATEGORIES) {
      expect(category.themes.length).toBeGreaterThanOrEqual(7);
      expect(category.scenes.length).toBeGreaterThanOrEqual(5);
      expect(new Set(category.themes).size).toBe(category.themes.length);
      for (const theme of category.themes) expect(theme).not.toMatch(/crie (um )?carrossel|criar carrosséis/i);
      // fora da categoria de conteúdo, nenhum tema fala de criação de conteúdo
      if (category.id !== "CRIACAO_CONTEUDO") for (const theme of category.themes) expect(findCreatorBias(theme), theme).toEqual([]);
    }
  });
});

describe("planejador — 20 seleções simuladas", () => {
  const plans = simulate(20);
  it("distribuição variada e Criação de conteúdo não domina", () => {
    const cats = plans.map((p) => p.categoryId);
    expect(new Set(cats).size).toBeGreaterThanOrEqual(10);
    expect(cats.filter((c) => c === "CRIACAO_CONTEUDO").length).toBeLessThanOrEqual(2);
  });
  it("nunca repete categoria nas últimas 3", () => {
    plans.forEach((plan, i) => {
      const previous = plans.slice(Math.max(0, i - 3), i).map((p) => p.categoryId);
      expect(previous).not.toContain(plan.categoryId);
    });
  });
  it("nunca repete tema (nem parecido) nos últimos 15", () => {
    plans.forEach((plan, i) => {
      for (const earlier of plans.slice(Math.max(0, i - 15), i)) expect(textSimilarity(plan.topic, earlier.topic)).toBeLessThan(0.7);
    });
  });
  it("estrutura narrativa e convite final não se repetem em sequência", () => {
    plans.forEach((plan, i) => {
      if (i === 0) return;
      expect(plan.structureId).not.toBe(plans[i - 1].structureId);
      expect(plan.inviteId).not.toBe(plans[i - 1].inviteId);
      if (i > 1) {
        expect(plan.structureId).not.toBe(plans[i - 2].structureId);
        expect(plan.inviteId).not.toBe(plans[i - 2].inviteId);
      }
    });
  });
  it("sem relaxamento enquanto há temas livres", () => {
    expect(plans.every((p) => p.relaxed.length === 0)).toBe(true);
  });
  it("histórico funciona: a mesma semente com outro histórico escolhe outra coisa; a mesma semente e histórico, a mesma coisa", () => {
    const empty: PlannerHistory = { categories: [], topics: [], structures: [], invites: [] };
    const first = planCarousel({ config: cfg, history: empty, seed: "x" });
    expect(planCarousel({ config: cfg, history: empty, seed: "x" })).toEqual(first);
    const second = planCarousel({ config: cfg, history: { categories: [first.categoryId], topics: [first.topic], structures: [first.structureId], invites: [first.inviteId] }, seed: "x" });
    expect(second.categoryId).not.toBe(first.categoryId);
    expect(second.topic).not.toBe(first.topic);
  });
});

describe("planejador — distribuição em escala e configuração", () => {
  it("300 gerações: segue os pesos e Criação de conteúdo fica em torno de 3–4%", () => {
    const plans = simulate(300, cfg, "big");
    const share = (id: string) => plans.filter((p) => p.categoryId === id).length / plans.length;
    expect(share("CRIACAO_CONTEUDO")).toBeLessThan(0.08);
    expect(share("TECNOLOGIA")).toBeLessThan(share("PSICOLOGIA"));
    const used = new Set(plans.map((p) => p.categoryId));
    expect(used.size).toBe(19);
    for (const id of ["PSICOLOGIA", "FAMILIA", "DINHEIRO", "CURIOSIDADES"]) expect(share(id)).toBeGreaterThan(0.05);
  }, 30_000);
  it("categoria desligada ou com peso 0 nunca sai", () => {
    const config = { ...cfg, enabledCategories: cfg.enabledCategories.filter((id) => id !== "CRIACAO_CONTEUDO"), categoryWeights: { ...cfg.categoryWeights, FE: 0 } };
    const plans = simulate(120, config, "off");
    expect(plans.some((p) => p.categoryId === "CRIACAO_CONTEUDO")).toBe(false);
    expect(plans.some((p) => p.categoryId === "FE")).toBe(false);
  });
  it("só Criação de conteúdo ligada: funciona (o usuário manda), afrouxando a janela sem travar", () => {
    const config = { ...cfg, enabledCategories: ["CRIACAO_CONTEUDO" as const] };
    const plans = simulate(5, config, "only");
    expect(plans.every((p) => p.categoryId === "CRIACAO_CONTEUDO")).toBe(true);
    expect(plans[1].relaxed.join(" ")).toContain("janela de categorias");
  });
  it("banco esgotado dentro da janela: reaproveita o tema menos recente e avisa", () => {
    const only = CAROUSEL_CATEGORIES.find((c) => c.id === "AMIZADE")!;
    const config = { ...cfg, enabledCategories: ["AMIZADE" as const], avoidCategoryWindow: 0 };
    const history: PlannerHistory = { categories: only.themes.map(() => "AMIZADE"), topics: [...only.themes].reverse(), structures: [], invites: [] };
    const plan = planCarousel({ config, history, seed: "e" });
    expect(plan.topic).toBe(only.themes[0]); // o mais antigo (último da lista de recentes)
    expect(plan.relaxed.join(" ")).toContain("esgotado");
  });
  it("sem nenhuma categoria elegível: erro claro", () => {
    expect(() => planCarousel({ config: { ...cfg, enabledCategories: [] }, seed: "x" })).toThrow(/categoria/i);
  });
});

describe("configuração", () => {
  it("automações antigas (sem os campos novos) viram modo AUTO com todas as categorias e pesos padrão", () => {
    const old = normalizeSmartCarouselConfig({ slideCount: 8, antiRepeatWindow: 15 });
    expect(old.topicSource).toBe("AUTO");
    expect(old.enabledCategories).toHaveLength(19);
    expect(old.categoryWeights.FAMILIA).toBe(10);
    expect(old.avoidCategoryWindow).toBe(3);
    expect(old.avoidTopicWindow).toBe(15);
    expect([old.minPhotos, old.maxPhotos]).toEqual([3, 5]);
  });
  it("valida categorias, pesos e fotos (erro, nunca troca em silêncio)", () => {
    expect(validateSmartCarouselConfigInput({ enabledCategories: ["NAO_EXISTE"] })).not.toEqual([]);
    expect(validateSmartCarouselConfigInput({ categoryWeights: { FAMILIA: 101 } })).not.toEqual([]);
    expect(validateSmartCarouselConfigInput({ categoryWeights: { FAMILIA: 5.5 } })).not.toEqual([]);
    expect(validateSmartCarouselConfigInput({ enabledCategories: [] })).not.toEqual([]);
    expect(validateSmartCarouselConfigInput({ enabledCategories: ["FAMILIA"], categoryWeights: { FAMILIA: 0 } })).not.toEqual([]);
    expect(validateSmartCarouselConfigInput({ minPhotos: 5, maxPhotos: 3 })).not.toEqual([]);
    expect(validateSmartCarouselConfigInput({ topicSource: "XYZ" })).not.toEqual([]);
    expect(validateSmartCarouselConfigInput({ enabledCategories: ["FAMILIA", "VIDA"], categoryWeights: { FAMILIA: 10, VIDA: 0 }, topicSource: "AUTO", avoidCategoryWindow: 3, avoidTopicWindow: 15, minPhotos: 3, maxPhotos: 5 })).toEqual([]);
  });
});

describe("diretiva enviada à IA", () => {
  const longPrompt = `${"Crie carrosséis para a Alilu com autoridade visual. ".repeat(20)}Termine com reflexão impactante e convite elegante para acompanhar a Alilu.`;
  const plan = planCarousel({ config: cfg, seed: "d" });
  const directive = buildGenerationDirective({ basePrompt: longPrompt, plan, recentTopics: ["Tema A", "Tema B"], recentCategories: ["Família", "Dinheiro"], photos: { min: 3, max: 5, target: 4 } });
  it("leva o prompt base COMPLETO (o final não é cortado), categoria, tema e histórico", () => {
    expect(longPrompt.length).toBeGreaterThan(600);
    expect(directive).toContain("convite elegante para acompanhar a Alilu.");
    expect(directive).toContain(`CATEGORIA ESCOLHIDA: ${plan.categoryLabel}`);
    expect(directive).toContain(`TEMA DESTE CARROSSEL: ${plan.topic}`);
    expect(directive).toContain("ÚLTIMOS TEMAS");
    expect(directive).toContain("Tema A | Tema B");
    expect(directive).toContain("ÚLTIMAS CATEGORIAS: Família, Dinheiro");
    expect(directive).toContain("de 3 a 5 slides");
  });
  it("proíbe criação de conteúdo fora da categoria própria", () => {
    expect(directive).toMatch(/NÃO falar sobre criação de conteúdo/);
    const content = planCarousel({ config: { ...cfg, enabledCategories: ["CRIACAO_CONTEUDO"] }, seed: "c" });
    expect(buildGenerationDirective({ basePrompt: null, plan: content, recentTopics: [], recentCategories: [], photos: null })).not.toMatch(/NÃO falar sobre criação de conteúdo/);
  });
  it("o prompt base não vira o tema (aparece como orientação de estilo)", () => {
    expect(directive).toContain("NÃO é o tema");
  });
  it("chega em pesquisa, ganchos, roteiro e legenda", () => {
    const brand = { brandName: "Alilu" };
    const research = buildResearchPrompt({ topic: plan.topic, brand, today: "2026-10-06", slideCount: 8, directive });
    const hooks = buildHooksPrompt({ topic: plan.topic, brand, research: null, wanted: ["ORIGINAL"], directive });
    const script = buildScriptPrompt({ topic: plan.topic, brand, research: null, hook: null, slideCount: 8, directive });
    const caption = buildCaptionPrompt({ topic: plan.topic, brand, slides: [{ headline: "a", body: "b" }], sourceTitles: [], directive });
    for (const text of [research, hooks, script, caption]) {
      expect(text).toContain(`CATEGORIA ESCOLHIDA: ${plan.categoryLabel}`);
      expect(text).toContain("convite elegante para acompanhar a Alilu.");
    }
    expect(script).toMatch(/3 a 5 palavras/);
  });
  it("o prompt de sistema não presume criadores de conteúdo", () => {
    expect(CAROUSEL_SYSTEM_PROMPT).not.toMatch(/ferramentas para criadores/i);
    expect(CAROUSEL_SYSTEM_PROMPT).toMatch(/Não presuma que o leitor é criador de conteúdo/);
  });
});

describe("detector de viés", () => {
  it("pega criação de conteúdo e redes sociais", () => {
    expect(findCreatorBias("Como organizar suas ideias de conteúdo")).not.toEqual([]);
    expect(findCreatorBias("Poste todo dia para ganhar seguidores no Instagram")).not.toEqual([]);
    expect(findCreatorBias("O algoritmo e o engajamento")).not.toEqual([]);
    expect(findCreatorBias("Escreva um roteiro simples")).not.toEqual([]);
  });
  it("deixa passar texto de família, dinheiro e psicologia", () => {
    for (const text of ["O último colo que você não percebeu que seria o último", "Parcelar tudo pesa no fim do mês", "Por que algumas pessoas somem quando começam a gostar", "Acompanhe a Alilu para mais histórias como esta."]) {
      expect(findCreatorBias(text), text).toEqual([]);
    }
  });
});

describe("fotos: 3 a 5 por carrossel de 9 slides", () => {
  it("quantidade por densidade (emocional mais fotos; conceitual mais tipografia)", () => {
    const base = { min: 3, max: 5, textSlides: 8 };
    expect(targetPhotoCount({ ...base, density: "HIGH" })).toBe(5);
    expect(targetPhotoCount({ ...base, density: "MID" })).toBe(4);
    expect(targetPhotoCount({ ...base, density: "LOW" })).toBe(3);
    expect(targetPhotoCount({ ...base, density: "HIGH", textSlides: 4 })).toBe(2);
  });
  it("escolhe as marcadas pela IA, completa espaçado e nunca o último slide", () => {
    const slides = Array.from({ length: 9 }, (_, i) => ({ position: i + 1, visualKind: i === 1 || i === 8 ? "PHOTO" : "GRAPHIC" }));
    const chosen = choosePhotoPositions(slides, { target: 4, max: 5 });
    expect(chosen).toHaveLength(4);
    expect(chosen).toContain(2);
    expect(chosen).not.toContain(9);
    expect(chosen).toEqual([...chosen].sort((a, b) => a - b));
    // IA exagerou: limita ao máximo
    const all = slides.map((s) => ({ ...s, visualKind: "PHOTO" }));
    expect(choosePhotoPositions(all, { target: 3, max: 5 })).toHaveLength(5);
  });
});

describe("diagnóstico", () => {
  it("no formato pedido e sem segredos", () => {
    const line = formatCarouselDiagnostic({
      category: "Família", topic: "O último colo", topicSource: "AUTO", recentCategories: ["Dinheiro", "Psicologia", "Vida"], recentTopics: ["a", "b"],
      promptSource: "AutomationSettings", promptOverride: false, provider: "anthropic", model: "claude-x", finalPromptChars: 9000, creatorBias: [],
      imagesSelected: 4, imageIds: ["pexels:1", "pexels:2"], templatesSelected: 1, templateId: "alilu-solar", structure: "CENA", relaxed: [],
    });
    expect(line).toContain("CarouselGeneration / Category: Família / Topic: O último colo");
    expect(line).toContain("RecentCategories: [Dinheiro, Psicologia, Vida]");
    expect(line).toContain("PromptSource: AutomationSettings / PromptOverride: false");
    expect(line).toContain("ImagesSelected: 4");
    expect(line).not.toMatch(/key|token|secret/i);
  });
  it("estruturas e convites existem em quantidade para rotacionar", () => {
    expect(NARRATIVE_STRUCTURES.length).toBeGreaterThanOrEqual(5);
    expect(CLOSING_INVITES.length).toBeGreaterThanOrEqual(5);
  });
});
