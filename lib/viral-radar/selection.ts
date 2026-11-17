/**
 * Seleção (módulo puro): critérios, direitos → destino (A/B/C),
 * reabastecimento da fila e prioridade por score com envelhecimento.
 */
import {
  isLicenseScopeComplete,
  type AuthorizationStatus,
  type CandidateRoute,
  type CandidateStatus,
  type LicenseScope,
  type RadarCriteria,
  type SourceLicense,
} from "./types";

export interface CriteriaSubject {
  views: number | null;
  likes: number | null;
  comments: number | null;
  publishedAt: Date | null;
  score: number | null;
  /** Material próprio/licenciado: métricas públicas indisponíveis não reprovam. */
  authorized: boolean;
}

/** null = passou; texto = motivo da reprovação. */
export function failsCriteria(subject: CriteriaSubject, criteria: RadarCriteria, now: Date): string | null {
  const metric = (value: number | null, min: number, label: string): string | null => {
    if (min <= 0) return null;
    if (value === null) return subject.authorized ? null : `${label} indisponíveis (mínimo ${min.toLocaleString("pt-BR")})`;
    return value < min ? `${label}: ${value.toLocaleString("pt-BR")} < mínimo ${min.toLocaleString("pt-BR")}` : null;
  };
  const failure =
    metric(subject.views, criteria.minViews, "Visualizações") ??
    metric(subject.likes, criteria.minLikes, "Curtidas") ??
    metric(subject.comments, criteria.minComments, "Comentários");
  if (failure) return failure;
  if (subject.publishedAt && criteria.maxAgeHours > 0) {
    const ageHours = (now.getTime() - subject.publishedAt.getTime()) / 3_600_000;
    if (ageHours > criteria.maxAgeHours) return `Mais antigo que ${criteria.maxAgeHours} h`;
  }
  if (criteria.minScore > 0) {
    if (subject.score === null) return "Viral Score indisponível (dados insuficientes)";
    if (subject.score < criteria.minScore) return `Viral Score ${subject.score} < mínimo ${criteria.minScore}`;
  }
  return null;
}

export interface SourceRights {
  license: SourceLicense;
  scope: Partial<LicenseScope> | null;
  declaredAt: Date | null;
}

/**
 * Autorização herdada da fonte. Ser PÚBLICO nunca implica autorização:
 * só fonte própria/licenciada, com declaração registrada e escopo
 * completo (edição + republicação + uso comercial), autoriza.
 */
export function authorizationFromSource(rights: SourceRights | null): { status: AuthorizationStatus; type: "OWN" | "LICENSED" | null; note: string } {
  if (!rights || rights.license === "NONE") return { status: "NOT_AUTHORIZED", type: null, note: "Conteúdo de terceiros: público não significa autorizado." };
  if (!rights.declaredAt) return { status: "PENDING_REVIEW", type: null, note: "Fonte sem declaração de direitos registrada." };
  if (!isLicenseScopeComplete(rights.scope)) {
    return { status: "PENDING_REVIEW", type: null, note: "A licença declarada não cobre edição, republicação e uso comercial." };
  }
  return {
    status: "AUTHORIZED",
    type: rights.license,
    note: rights.license === "OWN" ? "Conteúdo próprio (declarado pelo usuário)." : "Conteúdo licenciado (declarado pelo usuário).",
  };
}

export interface RouteDecision {
  route: CandidateRoute;
  status: CandidateStatus;
}

/**
 * A: autorizado + modo automático → vai para a fila.
 * C: terceiros com modo supervisionado (ou autorizado sem modo automático) → aguarda aprovação/revisão.
 * B: terceiros sem modo supervisionado → só referência para conteúdo original.
 */
export function decideRoute(authorization: AuthorizationStatus, modes: { autoMode: boolean; supervisedMode: boolean }): RouteDecision {
  if (authorization === "AUTHORIZED") {
    return modes.autoMode ? { route: "A", status: "ELIGIBLE" } : { route: "C", status: "AWAITING_AUTHORIZATION" };
  }
  if (authorization === "PENDING_REVIEW") return { route: "C", status: "AWAITING_AUTHORIZATION" };
  return modes.supervisedMode ? { route: "C", status: "AWAITING_AUTHORIZATION" } : { route: "B", status: "REFERENCE" };
}

export interface QueueStock {
  /** Prontos para publicar. */
  ready: number;
  /** Em importação/processamento (vão ficar prontos). */
  inPipeline: number;
  /** Agendados e ainda não publicados. */
  scheduled: number;
}

export interface RefillPlan {
  available: number;
  needsRefill: boolean;
  /** Quantos itens novos cabem até a fila ideal. */
  slots: number;
}

/**
 * Reabastece quando os vídeos PRONTOS + em processamento ficam abaixo do
 * mínimo; completa até o tamanho ideal (agendados contam como estoque).
 */
export function planRefill(stock: QueueStock, queueMin: number, queueTarget: number): RefillPlan {
  const available = Math.max(0, stock.ready) + Math.max(0, stock.inPipeline);
  const total = available + Math.max(0, stock.scheduled);
  return {
    available,
    needsRefill: available < queueMin,
    slots: Math.max(0, queueTarget - total),
  };
}

/** Pesquisa agendada desnecessária: fila já abastecida (controle de custo). */
export function queueIsStocked(stock: QueueStock, queueTarget: number): boolean {
  return stock.ready + stock.inPipeline + stock.scheduled >= queueTarget;
}

/**
 * Espera antes de nova tentativa de reabastecimento sem resultado:
 * 30 min, 1 h, 2 h… até a frequência do radar (sem pesquisas infinitas).
 */
export function refillCooldownMinutes(emptyStreak: number, frequencyMinutes: number): number {
  return Math.min(frequencyMinutes, 30 * 2 ** Math.max(0, Math.min(emptyStreak, 10)));
}

/** Backoff após falha de execução: 15 min, 30, 60… até 24 h. */
export function failureBackoffMinutes(consecutiveFailures: number): number {
  return Math.min(24 * 60, 15 * 2 ** Math.max(0, Math.min(consecutiveFailures - 1, 10)));
}

export interface PriorityItem {
  id: string;
  score: number | null;
  enqueuedAt: Date;
  position: number;
}

/**
 * Prioridade por Viral Score com envelhecimento: +agingPerDay pontos por
 * dia de espera, para que itens de score menor não fiquem presos para
 * sempre. FIFO mantém a ordem de chegada.
 */
export function orderByPriority(items: PriorityItem[], mode: "FIFO" | "SCORE", now: Date, agingPerDay = 10): string[] {
  if (mode === "FIFO") return [...items].sort((a, b) => a.position - b.position).map((item) => item.id);
  const priority = (item: PriorityItem) => (item.score ?? 0) + (agingPerDay * Math.max(0, now.getTime() - item.enqueuedAt.getTime())) / 86_400_000;
  return [...items].sort((a, b) => priority(b) - priority(a) || a.position - b.position).map((item) => item.id);
}

/** Identidade normalizada de uma URL (dedupe): sem fragmento, sem parâmetros de rastreio, host minúsculo, sem "www.". */
export function normalizeCandidateUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|si$|feature$|ref$|igsh$)/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return raw.trim();
  }
}
