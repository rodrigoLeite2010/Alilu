// SmartStoryEngine — domínio puro (sem banco, sem rede): seleção por
// horário, ponderação, antirrepetição, validação do JSON da IA, retry
// controlado e fallback.
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_TYPE_WEIGHTS,
  STORY_CAPABILITIES,
  STORY_TYPES,
  bucketForTime,
  buildFallbackContent,
  defaultSmartStoryConfig,
  generateStoryContent,
  normalizeSmartStoryConfig,
  planStory,
  truncateSafely,
  validateStoryContent,
  StoryValidationError,
  type StoryAiCaller,
  type StoryHistoryItem,
  type StoryType,
} from "@/lib/content-automation/smart-story";
import { candidateTypes, pickMascot } from "@/lib/content-automation/smart-story/selection";
import { FALLBACK_CONTENT } from "@/lib/content-automation/smart-story/fallback";
import { REQUIRED_FIELDS } from "@/lib/content-automation/smart-story/schema";

const config = defaultSmartStoryConfig();

function item(storyType: StoryType, headline: string, extra: Partial<StoryHistoryItem> = {}): StoryHistoryItem {
  return { storyType, headline, topic: headline, cta: "", usedMascot: false, generatedAt: new Date(), ...extra };
}

function validContent(type: StoryType, overrides: Record<string, unknown> = {}) {
  return {
    type,
    headline: `Título de ${type}`,
    body: type === "CHECKLIST" ? "Item um\nItem dois\nItem três" : "Um corpo curto e legível.",
    optionA: "Opção A",
    optionB: "Opção B",
    cta: "Responda no direct",
    visualMood: "emotional",
    topic: "assunto",
    ...overrides,
  };
}

describe("estratégia por horário", () => {
  it("08:00 / 12:00 / 19:00 caem nas faixas manhã / meio do dia / noite", () => {
    expect(bucketForTime(config, "08:00").id).toBe("morning");
    expect(bucketForTime(config, "12:00").id).toBe("midday");
    expect(bucketForTime(config, "19:00").id).toBe("evening");
    expect(bucketForTime(config, "10:59").id).toBe("morning");
    expect(bucketForTime(config, "11:00").id).toBe("midday");
    expect(bucketForTime(config, "17:00").id).toBe("evening");
  });

  it("sorteia só tipos da faixa do horário, em muitos dias", () => {
    const allowed: Record<string, StoryType[]> = {
      "08:00": ["REFLECTION", "EMOTIONAL_QUESTION", "ADVICE", "MINI_STORY"],
      "12:00": ["VISUAL_POLL", "CHOICE_AB", "COMPLETE_SENTENCE", "CURIOSITY"],
      "19:00": ["CTA", "ALILU_BRAND", "REFLECTION", "CHECKLIST"],
    };
    for (const [time, types] of Object.entries(allowed)) {
      for (let day = 0; day < 60; day += 1) {
        const plan = planStory({ seed: `auto|2026-10-${day}|${time}`, time, config, history: [] });
        expect(types).toContain(plan.type);
      }
    }
  });

  it("dias diferentes e vários horários no mesmo dia dão planos diferentes", () => {
    const types = new Set<StoryType>();
    for (let day = 1; day <= 30; day += 1) {
      for (const time of ["08:00", "12:00", "19:00"]) {
        types.add(planStory({ seed: `a|d${day}|${time}`, time, config, history: [] }).type);
      }
    }
    expect(types.size).toBeGreaterThanOrEqual(8);
  });

  it("é determinístico: mesma semente + histórico = mesmo plano (retry/cron duplicado)", () => {
    const history = [item("REFLECTION", "x")];
    const a = planStory({ seed: "s1", time: "08:00", config, history });
    const b = planStory({ seed: "s1", time: "08:00", config, history });
    expect(a).toEqual(b);
  });

  it("o plano é SINGLE (sequência só preparada) e capabilities nativas são todas false", () => {
    const plan = planStory({ seed: "s", time: "12:00", config, history: [] });
    expect(plan.layout).toBe("SINGLE");
    expect(plan.sequenceCount).toBe(1);
    expect(STORY_CAPABILITIES).toEqual({ supportsNativePoll: false, supportsQuestionSticker: false, supportsLinkSticker: false });
  });
});

describe("pesos e rotação", () => {
  it("respeita os pesos: peso 0 nunca sai e o maior sai mais", () => {
    const weighted = normalizeSmartStoryConfig({
      enabledTypes: ["REFLECTION", "ADVICE", "MINI_STORY"],
      typeWeights: { REFLECTION: 90, ADVICE: 10, MINI_STORY: 0 },
      avoidTypeWindow: 0,
    });
    const counts: Record<string, number> = {};
    for (let index = 0; index < 400; index += 1) {
      const { type } = planStory({ seed: `w${index}`, time: "08:00", config: weighted, history: [] });
      counts[type] = (counts[type] ?? 0) + 1;
    }
    expect(counts.MINI_STORY).toBeUndefined();
    expect(counts.REFLECTION).toBeGreaterThan(counts.ADVICE * 3);
  });

  it("nunca repete o tipo do Story imediatamente anterior", () => {
    for (let index = 0; index < 200; index += 1) {
      const plan = planStory({ seed: `r${index}`, time: "08:00", config, history: [item("REFLECTION", "a")] });
      expect(plan.type).not.toBe("REFLECTION");
    }
  });

  it("evita os últimos N tipos (janela configurável) enquanto houver alternativa", () => {
    const history = [item("REFLECTION", "a"), item("EMOTIONAL_QUESTION", "b"), item("ADVICE", "c")];
    for (let index = 0; index < 100; index += 1) {
      const plan = planStory({ seed: `j${index}`, time: "08:00", config, history });
      expect(plan.type).toBe("MINI_STORY"); // único da faixa fora da janela de 3
    }
  });

  it("relaxa a janela (sem travar) quando só sobra um tipo possível", () => {
    const only = normalizeSmartStoryConfig({ enabledTypes: ["REFLECTION"] });
    const plan = planStory({ seed: "x", time: "08:00", config: only, history: [item("REFLECTION", "a")] });
    expect(plan.type).toBe("REFLECTION");
  });

  it("a faixa esvaziada pela exclusão cai nos demais tipos habilitados", () => {
    const history = [item("VISUAL_POLL", "a"), item("CHOICE_AB", "b"), item("COMPLETE_SENTENCE", "c")];
    const types = candidateTypes({ time: "12:00", config, history });
    expect(types).toEqual(["CURIOSITY"]);
    const history4 = [...history, item("CURIOSITY", "d")];
    // Janela só olha os 3 mais recentes: CURIOSITY (4º) volta a ser permitido.
    expect(candidateTypes({ time: "12:00", config, history: history4 })).toEqual(["CURIOSITY"]);
  });

  it("os pesos padrão do briefing estão presentes", () => {
    expect(DEFAULT_TYPE_WEIGHTS).toMatchObject({
      REFLECTION: 20,
      EMOTIONAL_QUESTION: 20,
      MINI_STORY: 15,
      VISUAL_POLL: 15,
      CTA: 10,
      CURIOSITY: 10,
      CHECKLIST: 10,
    });
  });
});

describe("mascote", () => {
  it("aparece de vez em quando (~1 a cada 5) e nunca em dois seguidos", () => {
    let hits = 0;
    const total = 1000;
    for (let index = 0; index < total; index += 1) {
      if (pickMascot(`m${index}`, config, [])) hits += 1;
    }
    expect(hits / total).toBeGreaterThan(0.14);
    expect(hits / total).toBeLessThan(0.27);
    for (let index = 0; index < 100; index += 1) {
      expect(pickMascot(`m${index}`, config, [item("REFLECTION", "a", { usedMascot: true })])).toBe(false);
    }
  });

  it("frequência 0 desliga o mascote", () => {
    const off = normalizeSmartStoryConfig({ mascotEveryN: 0 });
    for (let index = 0; index < 50; index += 1) expect(pickMascot(`o${index}`, off, [])).toBe(false);
  });
});

describe("configuração", () => {
  it("lixo vira o padrão e nunca lança", () => {
    for (const raw of [null, undefined, 42, "x", [], { enabledTypes: "no", typeWeights: { REFLECTION: -5, X: 1 }, timeBuckets: [{}] }]) {
      const normalized = normalizeSmartStoryConfig(raw);
      expect(normalized.enabledTypes.length).toBeGreaterThan(0);
      expect(normalized.timeBuckets.length).toBe(3);
      expect(normalized.typeWeights.REFLECTION).toBe(20);
    }
  });

  it("aceita uma estratégia por horário personalizada válida e rejeita faixas sobrepostas", () => {
    const custom = normalizeSmartStoryConfig({
      timeBuckets: [
        { id: "a", fromMinute: 0, toMinute: 720, types: ["CTA"] },
        { id: "b", fromMinute: 720, toMinute: 1440, types: ["ADVICE"] },
      ],
    });
    expect(custom.timeBuckets.map((bucket) => bucket.id)).toEqual(["a", "b"]);
    const overlapping = normalizeSmartStoryConfig({
      timeBuckets: [
        { id: "a", fromMinute: 0, toMinute: 800, types: ["CTA"] },
        { id: "b", fromMinute: 700, toMinute: 1440, types: ["ADVICE"] },
      ],
    });
    expect(overlapping.timeBuckets.map((bucket) => bucket.id)).toEqual(["morning", "midday", "evening"]);
  });
});

describe("validação do JSON da IA", () => {
  it("aceita conteúdo válido de cada tipo", () => {
    for (const type of STORY_TYPES) {
      const content = validateStoryContent({ raw: validContent(type), type, history: [], seed: "s" });
      expect(content.type).toBe(type);
      expect(content.headline).toBeTruthy();
    }
  });

  it("rejeita o que não é objeto, sem título e sem campos obrigatórios do tipo", () => {
    expect(() => validateStoryContent({ raw: "texto", type: "REFLECTION", history: [], seed: "s" })).toThrow(StoryValidationError);
    expect(() => validateStoryContent({ raw: validContent("REFLECTION", { headline: "" }), type: "REFLECTION", history: [], seed: "s" })).toThrow(/headline/);
    expect(() => validateStoryContent({ raw: validContent("VISUAL_POLL", { optionB: "" }), type: "VISUAL_POLL", history: [], seed: "s" })).toThrow(/optionB/);
    expect(() => validateStoryContent({ raw: validContent("MINI_STORY", { body: "" }), type: "MINI_STORY", history: [], seed: "s" })).toThrow(/body/);
    expect(() => validateStoryContent({ raw: validContent("CTA", { cta: "" }), type: "CTA", history: [], seed: "s" })).toThrow(/cta/);
  });

  it("todo tipo tem seus campos obrigatórios declarados", () => {
    for (const type of STORY_TYPES) expect(REQUIRED_FIELDS[type]).toBeDefined();
  });

  it("rejeita opções A/B iguais e checklist com 1 item", () => {
    expect(() => validateStoryContent({ raw: validContent("CHOICE_AB", { optionA: "Sim", optionB: "sim" }), type: "CHOICE_AB", history: [], seed: "s" })).toThrow(/iguais/);
    expect(() => validateStoryContent({ raw: validContent("CHECKLIST", { body: "Só um" }), type: "CHECKLIST", history: [], seed: "s" })).toThrow(/2 itens/);
  });

  it("rejeita título repetido de Story recente (ignora acento e pontuação)", () => {
    const history = [item("REFLECTION", "Hoje é um bom dia!")];
    expect(() => validateStoryContent({ raw: validContent("REFLECTION", { headline: "hoje e um bom dia" }), type: "REFLECTION", history, seed: "s" })).toThrow(/repetido/);
  });

  it("o tipo planejado vence o que a IA devolveu", () => {
    const content = validateStoryContent({ raw: validContent("ADVICE", { type: "CTA" }), type: "ADVICE", history: [], seed: "s" });
    expect(content.type).toBe("ADVICE");
  });

  it("corta com segurança nos limites (80/180/40/60), sem quebrar palavra", () => {
    const long = "palavra ".repeat(60).trim();
    const content = validateStoryContent({
      raw: validContent("MINI_STORY", { headline: long, body: long, cta: long }),
      type: "MINI_STORY",
      history: [],
      seed: "s",
    });
    expect(content.headline.length).toBeLessThanOrEqual(80);
    expect(content.body.length).toBeLessThanOrEqual(180);
    expect(content.cta.length).toBeLessThanOrEqual(60);
    expect(content.headline.endsWith("…")).toBe(true);
    expect(content.headline).not.toMatch(/palav…$/);
    expect(truncateSafely("curto", 80)).toBe("curto");
  });

  it("normaliza checklist (até 5 itens, sem marcadores) e remove emoji/markdown/aspas", () => {
    const content = validateStoryContent({
      raw: validContent("CHECKLIST", { headline: "**“Meu dia ✨”**", body: "1. um\n- dois\n• três\nA) quatro\n5) cinco\nseis" }),
      type: "CHECKLIST",
      history: [],
      seed: "s",
    });
    expect(content.headline).toBe("Meu dia");
    expect(content.body.split("\n")).toEqual(["um", "dois", "três", "quatro", "cinco"]);
  });

  it("não deixa o Story prometer interação nativa que a API não publica", () => {
    expect(() => validateStoryContent({ raw: validContent("VISUAL_POLL", { headline: "Vote agora: A ou B?" }), type: "VISUAL_POLL", history: [], seed: "s" })).toThrow(/interação nativa/);
    const content = validateStoryContent({ raw: validContent("VISUAL_POLL", { cta: "Toque para votar" }), type: "VISUAL_POLL", history: [], seed: "s" });
    expect(content.cta).not.toMatch(/toque|vote/i);
    expect(content.cta).toMatch(/direct|Reaja|Responda|Manda|Me conta/i);
  });

  it("troca o CTA repetido por outro e sempre devolve um CTA", () => {
    const history = [item("REFLECTION", "x", { cta: "Responda no direct" })];
    const content = validateStoryContent({ raw: validContent("ADVICE", { cta: "responda no direct" }), type: "ADVICE", history, seed: "s" });
    expect(content.cta).not.toBe("Responda no direct");
    expect(content.cta).not.toBe("");
    const empty = validateStoryContent({ raw: validContent("ADVICE", { cta: "" }), type: "ADVICE", history: [], seed: "s" });
    expect(empty.cta).toBeTruthy();
  });

  it("clima visual inválido volta ao padrão do tipo", () => {
    const content = validateStoryContent({ raw: validContent("CTA", { visualMood: "arco-íris" }), type: "CTA", history: [], seed: "s" });
    expect(content.visualMood).toBe("dark");
  });
});

describe("geração com retry controlado e fallback", () => {
  const plan = planStory({ seed: "g", time: "12:00", config, history: [] });
  const base = { plan, seed: "g", basePrompt: "Fale de gratidão.", brandContext: "", history: [] as StoryHistoryItem[], contextWindow: 5 };

  it("caminho feliz: 1 chamada, fonte AI", async () => {
    const callAi = vi.fn<StoryAiCaller>(async () => ({ content: validContent(plan.type), usage: { tokens: 1 } }));
    const result = await generateStoryContent({ ...base, callAi });
    expect(result.source).toBe("AI");
    expect(result.attempts).toBe(1);
    expect(callAi).toHaveBeenCalledTimes(1);
    expect(result.usages).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });

  it("retorno inválido → 1 retry que diz à IA o problema → aceita o segundo", async () => {
    const callAi = vi
      .fn()
      .mockResolvedValueOnce({ content: { headline: "" } })
      .mockResolvedValueOnce({ content: validContent(plan.type) });
    const result = await generateStoryContent({ ...base, callAi });
    expect(result.source).toBe("AI");
    expect(result.attempts).toBe(2);
    expect(callAi.mock.calls[1][0]).toContain("A tentativa anterior foi rejeitada");
    expect(result.errors).toHaveLength(1);
  });

  it("IA fora do ar (todas as tentativas) → FALLBACK válido, sem lançar", async () => {
    const callAi = vi.fn(async () => {
      throw new Error("O provedor de IA respondeu com erro (HTTP 529).");
    });
    const result = await generateStoryContent({ ...base, callAi });
    expect(result.source).toBe("FALLBACK");
    expect(callAi).toHaveBeenCalledTimes(2);
    expect(result.errors.join(" ")).toContain("HTTP 529");
    expect(result.content.type).toBe(plan.type);
    expect(result.content.headline).toBeTruthy();
  });

  it("retorno inválido nas duas tentativas → FALLBACK", async () => {
    const callAi = vi.fn(async () => ({ content: { body: "sem título" } }));
    const result = await generateStoryContent({ ...base, callAi });
    expect(result.source).toBe("FALLBACK");
  });

  it("IA sem configuração (erro de chave) também cai no fallback e não vaza segredo", async () => {
    const callAi = vi.fn(async () => {
      throw new Error("CONTENT_AI_API_KEY não está configurada.");
    });
    const result = await generateStoryContent({ ...base, callAi });
    expect(result.source).toBe("FALLBACK");
    expect(result.promptUsed).not.toMatch(/sk-|api[_-]?key/i);
  });

  it("o prompt traz tipo, tema, regra anti-interação, JSON esperado e os últimos Stories", async () => {
    const history = [item("REFLECTION", "Título anterior importante")];
    const callAi = vi.fn<StoryAiCaller>(async () => ({ content: validContent(plan.type) }));
    await generateStoryContent({ ...base, history, callAi });
    const prompt = callAi.mock.calls[0][0] as string;
    expect(prompt).toContain(plan.type);
    expect(prompt).toContain("Título anterior importante");
    expect(prompt).toContain("nunca prometa enquete, pergunta ou link clicáveis");
    expect(prompt).toContain('"headline"');
    expect(prompt).toContain("Fale de gratidão.");
  });

  it("o contexto da IA é cortado em contextWindow, mas a antirrepetição usa o histórico inteiro", async () => {
    const history = Array.from({ length: 8 }, (_, index) => item("REFLECTION", `Título ${index}`));
    const callAi = vi.fn<StoryAiCaller>(async () => ({ content: validContent(plan.type, { headline: "Título 7" }) }));
    const result = await generateStoryContent({ ...base, history, contextWindow: 5, callAi, maxAttempts: 1 });
    const prompt = callAi.mock.calls[0][0] as string;
    expect(prompt).toContain("Título 4");
    expect(prompt).not.toContain("Título 6"); // fora da janela de 5
    expect(result.source).toBe("FALLBACK"); // "Título 7" repetiu um título do histórico completo
  });
});

describe("fallback", () => {
  it("todo tipo tem fallback que passa na MESMA validação (nada inválido no pior caso)", () => {
    for (const type of STORY_TYPES) {
      expect(FALLBACK_CONTENT[type].length).toBeGreaterThan(0);
      const content = buildFallbackContent(type, "seed", []);
      expect(() => validateStoryContent({ raw: content, type, history: [], seed: "seed" })).not.toThrow();
    }
  });

  it("pula títulos recentes e repete (em vez de abortar) quando todos já foram usados", () => {
    const [first, second] = FALLBACK_CONTENT.REFLECTION;
    const history = [item("REFLECTION", first.headline)];
    for (let index = 0; index < 30; index += 1) {
      expect(buildFallbackContent("REFLECTION", `s${index}`, history).headline).not.toBe(first.headline);
    }
    const all = FALLBACK_CONTENT.REFLECTION.map((entry) => item("REFLECTION", entry.headline));
    expect(buildFallbackContent("REFLECTION", "s", all).headline).toBeTruthy();
    expect(second).toBeDefined();
  });
});
