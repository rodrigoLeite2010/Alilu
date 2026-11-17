/**
 * Comparação de desempenho das publicações próprias (puro): médias por
 * plataforma, horário, estilo de legenda e tipo de conteúdo, com
 * recomendações simples SÓ quando há amostra suficiente. Métrica ausente
 * não entra na média (nunca vira zero).
 */

export interface PerformanceSample {
  platform: string;
  publishedAt: Date | null;
  captionStyle: string | null;
  contentType: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
}

export interface GroupStat {
  key: string;
  samples: number;
  avgLikes: number | null;
  avgComments: number | null;
  avgViews: number | null;
}

export const MIN_SAMPLES_FOR_RECOMMENDATION = 3;

function avg(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return present.length ? Math.round((present.reduce((sum, value) => sum + value, 0) / present.length) * 10) / 10 : null;
}

function hourIn(date: Date, timeZone: string): string {
  const hour = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone }).format(date);
  return `${hour}h`;
}

export function groupBy(samples: PerformanceSample[], keyOf: (sample: PerformanceSample) => string | null): GroupStat[] {
  const groups = new Map<string, PerformanceSample[]>();
  for (const sample of samples) {
    const key = keyOf(sample);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), sample]);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({
      key,
      samples: list.length,
      avgLikes: avg(list.map((item) => item.likes)),
      avgComments: avg(list.map((item) => item.comments)),
      avgViews: avg(list.map((item) => item.views)),
    }))
    .sort((a, b) => (b.avgLikes ?? -1) - (a.avgLikes ?? -1));
}

export interface PerformanceReport {
  totalSamples: number;
  byPlatform: GroupStat[];
  byHour: GroupStat[];
  byStyle: GroupStat[];
  byContentType: GroupStat[];
  recommendations: string[];
}

export function buildPerformanceReport(samples: PerformanceSample[], timeZone = "America/Sao_Paulo"): PerformanceReport {
  const byPlatform = groupBy(samples, (sample) => sample.platform);
  const byHour = groupBy(samples, (sample) => (sample.publishedAt ? hourIn(sample.publishedAt, timeZone) : null));
  const byStyle = groupBy(samples, (sample) => sample.captionStyle);
  const byContentType = groupBy(samples, (sample) => sample.contentType);
  const recommendations: string[] = [];
  const recommend = (groups: GroupStat[], label: string) => {
    const eligible = groups.filter((group) => group.samples >= MIN_SAMPLES_FOR_RECOMMENDATION && group.avgLikes !== null);
    if (eligible.length < 2) return;
    const [best, second] = eligible;
    if ((best.avgLikes ?? 0) > (second.avgLikes ?? 0) * 1.2) {
      recommendations.push(`${label} "${best.key}" teve em média ${best.avgLikes} curtidas (${best.samples} publicações), acima de "${second.key}" (${second.avgLikes}).`);
    }
  };
  recommend(byHour, "Horário");
  recommend(byStyle, "Estilo de legenda");
  recommend(byContentType, "Tipo de conteúdo");
  recommend(byPlatform, "Plataforma");
  if (recommendations.length === 0) {
    recommendations.push(
      samples.length < MIN_SAMPLES_FOR_RECOMMENDATION * 2
        ? "Ainda há poucas publicações medidas para comparar com segurança."
        : "Nenhuma diferença clara de desempenho entre horários, estilos ou formatos até agora.",
    );
  }
  return { totalSamples: samples.length, byPlatform, byHour, byStyle, byContentType, recommendations };
}
