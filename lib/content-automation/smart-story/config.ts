import {
  STORY_THEMES,
  STORY_TYPES,
  isStoryTheme,
  isStoryType,
  type StoryTheme,
  type StoryType,
} from "./types";

/** Faixa do dia → tipos preferidos. `fromMinute` inclusivo, `toMinute` exclusivo (0..1440). */
export interface TimeBucket {
  id: string;
  label: string;
  fromMinute: number;
  toMinute: number;
  types: StoryType[];
}

export interface SmartStoryConfig {
  enabled: boolean;
  /** Tipos habilitados (vazio nunca acontece: normalização volta ao padrão). */
  enabledTypes: StoryType[];
  /** Pesos RELATIVOS (não precisam somar 100). 0 = nunca sorteado. */
  typeWeights: Record<StoryType, number>;
  timeBuckets: TimeBucket[];
  themes: StoryTheme[];
  /** Não repetir o tipo nos últimos N Stories (0 desliga; o tipo imediatamente anterior sempre é evitado). */
  avoidTypeWindow: number;
  /** Quantos Stories recentes (título/tema) entram como contexto da IA e da antirrepetição. */
  contextWindow: number;
  /** Mascote: em média 1 a cada N Stories (0 = desligado). Nunca em dois seguidos. */
  mascotEveryN: number;
  /** Marca discreta (@alilu.tec / logo pequeno) — só liga/desliga; o desenho é da Fase 3. */
  showBrandHandle: boolean;
  language: "pt-BR";
}

/**
 * Pesos padrão (relativos). Os sete do briefing (motivação 20, pergunta
 * 20, mini-história 15, enquete 15, CTA 10, curiosidade 10, checklist 10)
 * + os tipos que só entram pela estratégia do horário.
 */
export const DEFAULT_TYPE_WEIGHTS: Record<StoryType, number> = {
  REFLECTION: 20,
  EMOTIONAL_QUESTION: 20,
  MINI_STORY: 15,
  VISUAL_POLL: 15,
  CTA: 10,
  CURIOSITY: 10,
  CHECKLIST: 10,
  CHOICE_AB: 8,
  COMPLETE_SENTENCE: 8,
  ADVICE: 8,
  ALILU_BRAND: 5,
};

/** 08:00 → manhã, 12:00 → meio do dia, 19:00 → noite (fronteiras 11h e 17h). */
export const DEFAULT_TIME_BUCKETS: TimeBucket[] = [
  {
    id: "morning",
    label: "Manhã",
    fromMinute: 0,
    toMinute: 11 * 60,
    types: ["REFLECTION", "EMOTIONAL_QUESTION", "ADVICE", "MINI_STORY"],
  },
  {
    id: "midday",
    label: "Meio do dia",
    fromMinute: 11 * 60,
    toMinute: 17 * 60,
    types: ["VISUAL_POLL", "CHOICE_AB", "COMPLETE_SENTENCE", "CURIOSITY"],
  },
  {
    id: "evening",
    label: "Noite",
    fromMinute: 17 * 60,
    toMinute: 24 * 60,
    types: ["CTA", "ALILU_BRAND", "REFLECTION", "CHECKLIST"],
  },
];

export function defaultSmartStoryConfig(): SmartStoryConfig {
  return {
    enabled: false,
    enabledTypes: [...STORY_TYPES],
    typeWeights: { ...DEFAULT_TYPE_WEIGHTS },
    timeBuckets: DEFAULT_TIME_BUCKETS.map((bucket) => ({ ...bucket, types: [...bucket.types] })),
    themes: [...STORY_THEMES],
    avoidTypeWindow: 3,
    contextWindow: 5,
    mascotEveryN: 5,
    showBrandHandle: true,
    language: "pt-BR",
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function intInRange(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Faixas válidas, ordenadas e sem sobreposição — ou null se qualquer faixa for inválida. */
function parseBuckets(value: unknown): TimeBucket[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const buckets: TimeBucket[] = [];
  for (const raw of value) {
    const item = asRecord(raw);
    const from = item.fromMinute;
    const to = item.toMinute;
    const types = Array.isArray(item.types) ? item.types.filter(isStoryType) : [];
    if (
      typeof item.id !== "string" ||
      typeof from !== "number" ||
      typeof to !== "number" ||
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      to > 1440 ||
      from >= to ||
      types.length === 0
    ) {
      return null;
    }
    buckets.push({
      id: item.id.slice(0, 40),
      label: typeof item.label === "string" ? item.label.slice(0, 40) : item.id,
      fromMinute: from,
      toMinute: to,
      types: [...new Set(types)],
    });
  }
  const sorted = [...buckets].sort((a, b) => a.fromMinute - b.fromMinute);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].fromMinute < sorted[index - 1].toMinute) return null;
  }
  return sorted;
}

/** Faixa inválida/sobreposta → volta ao padrão inteiro (nunca meia configuração). */
function normalizeBuckets(value: unknown): TimeBucket[] {
  return parseBuckets(value) ?? defaultSmartStoryConfig().timeBuckets;
}

/**
 * Lê a configuração salva (jsonb, qualquer formato, até lixo) e devolve
 * SEMPRE uma configuração completa e válida. Nunca lança: campo ausente ou
 * inválido volta ao padrão — a automação não pode quebrar por config ruim.
 */
export function normalizeSmartStoryConfig(raw: unknown, enabled?: boolean): SmartStoryConfig {
  const base = defaultSmartStoryConfig();
  const input = asRecord(raw);

  const enabledTypes = Array.isArray(input.enabledTypes) ? [...new Set(input.enabledTypes.filter(isStoryType))] : [];
  const weightsInput = asRecord(input.typeWeights);
  const typeWeights = { ...base.typeWeights };
  for (const type of STORY_TYPES) {
    const weight = weightsInput[type];
    if (typeof weight === "number" && Number.isFinite(weight) && weight >= 0) {
      typeWeights[type] = Math.min(1000, weight);
    }
  }
  const themes = Array.isArray(input.themes) ? [...new Set(input.themes.filter(isStoryTheme))] : [];

  return {
    enabled: enabled ?? input.enabled === true,
    enabledTypes: enabledTypes.length > 0 ? enabledTypes : base.enabledTypes,
    typeWeights,
    timeBuckets: normalizeBuckets(input.timeBuckets),
    themes: themes.length > 0 ? themes : base.themes,
    avoidTypeWindow: intInRange(input.avoidTypeWindow, 0, 10, base.avoidTypeWindow),
    contextWindow: intInRange(input.contextWindow, 0, 10, base.contextWindow),
    mascotEveryN: input.mascotEveryN === 0 ? 0 : intInRange(input.mascotEveryN, 2, 20, base.mascotEveryN),
    showBrandHandle: typeof input.showBrandHandle === "boolean" ? input.showBrandHandle : base.showBrandHandle,
    language: "pt-BR",
  };
}

/** Minutos desde 00:00 de "HH:mm" (null se inválido). */
export function minuteOfDay(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Faixa do dia que contém o horário (a primeira faixa se nenhuma contiver). */
export function bucketForTime(config: SmartStoryConfig, time: string): TimeBucket {
  const minute = minuteOfDay(time) ?? 0;
  return (
    config.timeBuckets.find((bucket) => minute >= bucket.fromMinute && minute < bucket.toMinute) ?? config.timeBuckets[0]
  );
}

/**
 * Valida uma configuração VINDA DO USUÁRIO (API) com mensagens claras.
 * Diferente de normalizeSmartStoryConfig (tolerante, lê o que já está salvo),
 * aqui valor inválido é erro — não é silenciosamente trocado pelo padrão.
 */
export function validateSmartStoryConfigInput(raw: unknown): string[] {
  const problems: string[] = [];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return ["A configuração precisa ser um objeto."];
  const input = raw as Record<string, unknown>;

  const list = (key: string, valid: (value: unknown) => boolean, label: string) => {
    if (input[key] === undefined) return;
    const value = input[key];
    if (!Array.isArray(value) || value.length === 0) problems.push(`${label}: escolha pelo menos um.`);
    else if (!value.every(valid)) problems.push(`${label}: há um valor inválido.`);
  };
  list("enabledTypes", isStoryType, "Tipos de Story");
  list("themes", isStoryTheme, "Temas");

  if (input.typeWeights !== undefined) {
    const weights = input.typeWeights;
    if (typeof weights !== "object" || weights === null || Array.isArray(weights)) {
      problems.push("Pesos: formato inválido.");
    } else {
      for (const [type, weight] of Object.entries(weights)) {
        if (!isStoryType(type)) problems.push(`Pesos: tipo desconhecido "${type}".`);
        else if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0 || weight > 1000) {
          problems.push(`Pesos: o peso de ${type} precisa ser um número de 0 a 1000.`);
        }
      }
    }
  }
  const range = (key: string, min: number, max: number, label: string) => {
    if (input[key] === undefined) return;
    const value = input[key];
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      problems.push(`${label}: use um número inteiro de ${min} a ${max}.`);
    }
  };
  range("avoidTypeWindow", 0, 10, "Janela de repetição");
  range("contextWindow", 0, 10, "Stories recentes no contexto");
  if (input.mascotEveryN !== undefined && input.mascotEveryN !== 0) range("mascotEveryN", 2, 20, "Frequência do mascote");
  if (input.showBrandHandle !== undefined && typeof input.showBrandHandle !== "boolean") problems.push("Marca discreta: use ligado ou desligado.");
  if (input.language !== undefined && input.language !== "pt-BR") problems.push('Idioma: só "pt-BR" por enquanto.');
  if (input.timeBuckets !== undefined && parseBuckets(input.timeBuckets) === null) {
    problems.push("Faixas de horário inválidas: use faixas de 0 a 1440 minutos, sem sobreposição e com pelo menos um tipo cada.");
  }
  return problems;
}
