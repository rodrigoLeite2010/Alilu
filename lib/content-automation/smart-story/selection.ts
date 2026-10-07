import { bucketForTime, type SmartStoryConfig } from "./config";
import { createRng, weightedPick } from "./random";
import {
  MIN_SEQUENCE_COUNT,
  STORY_THEMES,
  type StoryHistoryItem,
  type StoryPlan,
  type StoryTheme,
  type StoryType,
} from "./types";

export interface PlanStoryInput {
  /** Semente estável do horário — produção: `${automationId}|${scheduledAtIso}`. */
  seed: string;
  /** "HH:mm" no fuso da automação (decide a faixa do dia). */
  time: string;
  config: SmartStoryConfig;
  /** Stories anteriores, do MAIS RECENTE para o mais antigo. */
  history: StoryHistoryItem[];
}

/**
 * Candidatos de tipo para o horário, aplicando — em ordem de prioridade —
 *   1. tipos habilitados ∩ tipos da faixa do dia, com peso > 0;
 *   2. exclusão dos últimos `avoidTypeWindow` tipos (e SEMPRE do anterior);
 * e relaxando por etapas quando a exclusão esvazia a lista, para nunca
 * ficar sem opção: janela → só o anterior → faixa → tipos habilitados.
 */
export function candidateTypes(input: Pick<PlanStoryInput, "time" | "config" | "history">): StoryType[] {
  const { config, history, time } = input;
  const bucket = bucketForTime(config, time);
  const usable = (types: readonly StoryType[]) =>
    types.filter((type) => config.enabledTypes.includes(type) && config.typeWeights[type] > 0);

  const inBucket = usable(bucket.types);
  const anyEnabled = usable(config.enabledTypes);
  const previous = history[0]?.storyType;
  const windowTypes = new Set(history.slice(0, Math.max(1, config.avoidTypeWindow)).map((item) => item.storyType));

  const attempts: StoryType[][] = [
    inBucket.filter((type) => !windowTypes.has(type)),
    inBucket.filter((type) => type !== previous),
    anyEnabled.filter((type) => !windowTypes.has(type)),
    anyEnabled.filter((type) => type !== previous),
    inBucket,
    anyEnabled,
  ];
  for (const list of attempts) if (list.length > 0) return list;
  // Config sem nenhum tipo com peso > 0: último recurso, qualquer habilitado.
  return config.enabledTypes.length > 0 ? config.enabledTypes : (["REFLECTION"] as StoryType[]);
}

export function pickTheme(seed: string, config: SmartStoryConfig, history: StoryHistoryItem[]): StoryTheme {
  const rng = createRng(`${seed}|theme`);
  const themes = config.themes.length > 0 ? config.themes : [...STORY_THEMES];
  // Tema ≈ assunto: evita os temas dos últimos Stories quando há alternativa.
  const recentTopics = history
    .slice(0, Math.max(1, config.contextWindow))
    .map((item) => item.topic.toLowerCase());
  const fresh = themes.filter((theme) => !recentTopics.some((topic) => topic.includes(theme)));
  const pool = fresh.length > 0 ? fresh : themes;
  return pool[Math.floor(rng() * pool.length)];
}

export function pickMascot(seed: string, config: SmartStoryConfig, history: StoryHistoryItem[]): boolean {
  if (config.mascotEveryN <= 0) return false;
  if (history[0]?.usedMascot) return false; // nunca em dois Stories seguidos
  return createRng(`${seed}|mascot`)() < 1 / config.mascotEveryN;
}

/**
 * Decide o que o Story de um horário será — função PURA e determinística
 * (mesma semente + mesmo histórico = mesmo plano). Não chama IA.
 */
export function planStory(input: PlanStoryInput): StoryPlan {
  const { seed, config, history, time } = input;
  const candidates = candidateTypes({ time, config, history });
  const type = weightedPick(candidates, (candidate) => config.typeWeights[candidate], createRng(`${seed}|type`));
  return {
    type,
    theme: pickTheme(seed, config, history),
    useMascot: pickMascot(seed, config, history),
    layout: "SINGLE", // SEQUENCE (2–4) só preparado: ver MIN_SEQUENCE_COUNT/MAX_SEQUENCE_COUNT em types.ts
    sequenceCount: Math.max(1, MIN_SEQUENCE_COUNT - 1),
    timeBucket: bucketForTime(config, time).id,
  };
}
