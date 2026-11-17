/**
 * Viral Score (módulo puro e testado).
 *
 * Fórmula v1 — média ponderada de componentes normalizados em 0..1:
 *   - velocity    : crescimento REAL de visualizações por hora, calculado
 *                   só com DUAS observações reais separadas por pelo menos
 *                   30 min (nunca "views totais ÷ idade"). Escala log e
 *                   referência = p90 do lote (com piso), para que canais
 *                   gigantes não dominem todas as posições;
 *   - likeRate    : curtidas ÷ visualizações (teto 6%);
 *   - commentRate : comentários ÷ visualizações (teto 0,8%);
 *   - recency     : decaimento exponencial pela idade (meia-vida 48 h);
 *   - relevance   : aderência ao tema do radar (regras ou IA), 0..1.
 *
 * Componente sem dado (métrica indisponível, amostra pequena, só uma
 * observação) NÃO vira zero nem é estimado: fica de fora, explicitamente
 * listado. O resultado é a média dos componentes disponíveis multiplicada
 * por um fator de cobertura (0,5 + 0,5 × peso disponível), para que um
 * candidato com poucos dados não supere um com dados completos só por
 * acaso. Cobertura < 30% → sem score ("dados insuficientes").
 */
import { DEFAULT_SCORE_WEIGHTS, type ScoreWeights } from "./types";

export const SCORE_FORMULA_VERSION = "v1";
export const MIN_VELOCITY_INTERVAL_MINUTES = 30;
export const MIN_SAMPLE_VIEWS = 500;
export const LIKE_RATE_CAP = 0.06;
export const COMMENT_RATE_CAP = 0.008;
export const RECENCY_HALF_LIFE_HOURS = 48;
export const VELOCITY_REFERENCE_FLOOR = 1_000;
export const MIN_COVERAGE = 0.3;

export interface MetricObservation {
  observedAt: Date;
  views: number | null;
  likes: number | null;
  comments: number | null;
}

export type ScoreComponentKey = keyof ScoreWeights;

export interface ScoreComponent {
  key: ScoreComponentKey;
  weight: number;
  /** 0..1, ou null quando não há dado confiável. */
  value: number | null;
  /** Valor bruto (views/h, taxa, horas, relevância). */
  raw: number | null;
  note: string;
}

export interface ScoreResult {
  /** 0..100 com 1 casa, ou null (dados insuficientes). */
  score: number | null;
  coverage: number;
  components: ScoreComponent[];
  reason: string;
  version: string;
}

export interface ScoreInput {
  observations: MetricObservation[];
  publishedAt: Date | null;
  relevance: number | null;
  relevanceSource?: "rules" | "ai";
  now: Date;
}

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);
const fmtInt = (value: number) => Math.round(value).toLocaleString("pt-BR");
const fmtPct = (value: number) => `${(value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** Pesos válidos: inteiros 0..100 que somam 100. */
export function normalizeWeights(raw: Partial<Record<ScoreComponentKey, unknown>> | null | undefined): ScoreWeights {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SCORE_WEIGHTS };
  const keys = Object.keys(DEFAULT_SCORE_WEIGHTS) as ScoreComponentKey[];
  const weights = {} as ScoreWeights;
  for (const key of keys) {
    const value = Number(raw[key] ?? DEFAULT_SCORE_WEIGHTS[key]);
    if (!Number.isInteger(value) || value < 0 || value > 100) throw new Error("Pesos do Viral Score precisam ser inteiros entre 0 e 100.");
    weights[key] = value;
  }
  const total = keys.reduce((sum, key) => sum + weights[key], 0);
  if (total !== 100) throw new Error(`Os pesos do Viral Score precisam somar 100 (soma atual: ${total}).`);
  return weights;
}

/**
 * Crescimento por hora entre a observação mais recente e a anterior mais
 * próxima que esteja a ≥ 30 min dela. null = sem duas observações reais.
 */
export function viewsVelocity(observations: MetricObservation[]): { perHour: number; hours: number; delta: number } | null {
  const withViews = observations
    .filter((obs) => obs.views !== null && Number.isFinite(obs.views) && obs.observedAt instanceof Date && !Number.isNaN(obs.observedAt.getTime()))
    .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());
  if (withViews.length < 2) return null;
  const latest = withViews[0];
  const previous = withViews.find((obs) => latest.observedAt.getTime() - obs.observedAt.getTime() >= MIN_VELOCITY_INTERVAL_MINUTES * 60_000);
  if (!previous) return null;
  const hours = (latest.observedAt.getTime() - previous.observedAt.getTime()) / 3_600_000;
  if (hours <= 0) return null;
  // Contadores podem ser corrigidos para baixo pela plataforma: crescimento nunca é negativo.
  const delta = Math.max(0, (latest.views as number) - (previous.views as number));
  return { perHour: delta / hours, hours, delta };
}

/** Referência de velocidade do lote: p90 das velocidades reais, com piso (evita que um único gigante defina a escala). */
export function velocityReference(perHourValues: number[], floor = VELOCITY_REFERENCE_FLOOR): number {
  const values = perHourValues.filter((value) => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
  if (values.length === 0) return floor;
  const index = Math.min(values.length - 1, Math.floor(0.9 * (values.length - 1)));
  return Math.max(floor, values[index]);
}

function latestWith(observations: MetricObservation[], key: "views" | "likes" | "comments"): number | null {
  const sorted = [...observations].sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());
  for (const obs of sorted) {
    const value = obs[key];
    if (value !== null && Number.isFinite(value)) return value;
  }
  return null;
}

/** Taxa de engajamento só quando curtidas/comentários e views vêm da MESMA observação. */
function rateFromSameObservation(observations: MetricObservation[], key: "likes" | "comments"): { rate: number; views: number } | null | "small" {
  const sorted = [...observations].sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());
  const obs = sorted.find((item) => item.views !== null && item[key] !== null);
  if (!obs) return null;
  const views = obs.views as number;
  if (views < MIN_SAMPLE_VIEWS) return "small";
  return { rate: (obs[key] as number) / views, views };
}

export function computeViralScore(input: ScoreInput, weightsInput: ScoreWeights = DEFAULT_SCORE_WEIGHTS, reference = VELOCITY_REFERENCE_FLOOR): ScoreResult {
  const weights = weightsInput;
  const components: ScoreComponent[] = [];

  const velocity = viewsVelocity(input.observations);
  components.push(
    velocity
      ? {
          key: "velocity",
          weight: weights.velocity,
          value: clamp01(Math.log1p(velocity.perHour) / Math.log1p(Math.max(1, reference))),
          raw: velocity.perHour,
          note: `Crescimento ${fmtInt(velocity.perHour)} views/h (+${fmtInt(velocity.delta)} em ${velocity.hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h)`,
        }
      : { key: "velocity", weight: weights.velocity, value: null, raw: null, note: "Crescimento: aguardando 2ª observação" },
  );

  const likes = rateFromSameObservation(input.observations, "likes");
  components.push(
    likes === null
      ? { key: "likeRate", weight: weights.likeRate, value: null, raw: null, note: "Curtidas indisponíveis" }
      : likes === "small"
        ? { key: "likeRate", weight: weights.likeRate, value: null, raw: null, note: `Curtidas: amostra pequena (< ${MIN_SAMPLE_VIEWS} views)` }
        : { key: "likeRate", weight: weights.likeRate, value: clamp01(likes.rate / LIKE_RATE_CAP), raw: likes.rate, note: `Curtidas/views ${fmtPct(likes.rate)}` },
  );

  const comments = rateFromSameObservation(input.observations, "comments");
  components.push(
    comments === null
      ? { key: "commentRate", weight: weights.commentRate, value: null, raw: null, note: "Comentários indisponíveis" }
      : comments === "small"
        ? { key: "commentRate", weight: weights.commentRate, value: null, raw: null, note: `Comentários: amostra pequena (< ${MIN_SAMPLE_VIEWS} views)` }
        : {
            key: "commentRate",
            weight: weights.commentRate,
            value: clamp01(comments.rate / COMMENT_RATE_CAP),
            raw: comments.rate,
            note: `Comentários/views ${fmtPct(comments.rate)}`,
          },
  );

  if (input.publishedAt && !Number.isNaN(input.publishedAt.getTime())) {
    const ageHours = Math.max(0, (input.now.getTime() - input.publishedAt.getTime()) / 3_600_000);
    components.push({
      key: "recency",
      weight: weights.recency,
      value: clamp01(Math.pow(0.5, ageHours / RECENCY_HALF_LIFE_HOURS)),
      raw: ageHours,
      note: `Publicado há ${ageHours < 48 ? `${Math.round(ageHours)} h` : `${Math.round(ageHours / 24)} dias`}`,
    });
  } else {
    components.push({ key: "recency", weight: weights.recency, value: null, raw: null, note: "Data de publicação indisponível" });
  }

  if (input.relevance !== null && Number.isFinite(input.relevance)) {
    components.push({
      key: "relevance",
      weight: weights.relevance,
      value: clamp01(input.relevance),
      raw: input.relevance,
      note: `Relevância ${clamp01(input.relevance).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} (${input.relevanceSource === "ai" ? "IA" : "regras"})`,
    });
  } else {
    components.push({ key: "relevance", weight: weights.relevance, value: null, raw: null, note: "Relevância não avaliada" });
  }

  const totalWeight = components.reduce((sum, item) => sum + item.weight, 0);
  const available = components.filter((item) => item.value !== null && item.weight > 0);
  const availableWeight = available.reduce((sum, item) => sum + item.weight, 0);
  const coverage = totalWeight > 0 ? availableWeight / totalWeight : 0;

  let score: number | null = null;
  if (availableWeight > 0 && coverage >= MIN_COVERAGE) {
    const average = available.reduce((sum, item) => sum + item.weight * (item.value as number), 0) / availableWeight;
    score = Math.round(average * (0.5 + 0.5 * coverage) * 1000) / 10;
  }

  const missing = components.filter((item) => item.value === null && item.weight > 0).map((item) => item.note);
  const present = available.map((item) => item.note);
  const reason = [
    score === null ? `Dados insuficientes (cobertura ${Math.round(coverage * 100)}%).` : `Score ${score.toLocaleString("pt-BR")} (cobertura ${Math.round(coverage * 100)}%).`,
    present.join(" · "),
    missing.length ? `Sem dado: ${missing.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { score, coverage, components, reason, version: SCORE_FORMULA_VERSION };
}

/** Valor mais recente de cada métrica (para exibir e filtrar). */
export function latestMetrics(observations: MetricObservation[]): { views: number | null; likes: number | null; comments: number | null } {
  return { views: latestWith(observations, "views"), likes: latestWith(observations, "likes"), comments: latestWith(observations, "comments") };
}
