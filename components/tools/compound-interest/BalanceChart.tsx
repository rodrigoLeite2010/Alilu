import type { CompoundInterestMonth } from "@/lib/calculators/compound-interest";

const WIDTH = 600;
const HEIGHT = 220;
const PADDING = 8;

interface ChartPoint {
  month: number;
  invested: number;
  total: number;
}

function buildPoints(
  initialAmount: number,
  months: CompoundInterestMonth[]
): ChartPoint[] {
  return [
    { month: 0, invested: initialAmount, total: initialAmount },
    ...months.map((m) => ({
      month: m.month,
      invested: m.cumulativeInvested,
      total: m.endingBalance,
    })),
  ];
}

function scaleX(month: number, maxMonth: number): number {
  if (maxMonth === 0) return PADDING;
  return PADDING + (month / maxMonth) * (WIDTH - PADDING * 2);
}

function scaleY(value: number, maxValue: number): number {
  if (maxValue === 0) return HEIGHT - PADDING;
  return HEIGHT - PADDING - (value / maxValue) * (HEIGHT - PADDING * 2);
}

function buildAreaPath(
  points: ChartPoint[],
  key: "invested" | "total",
  maxMonth: number,
  maxValue: number
): string {
  const top = points
    .map(
      (point) =>
        `${scaleX(point.month, maxMonth)},${scaleY(point[key], maxValue)}`
    )
    .join(" L");

  const baseline = HEIGHT - PADDING;
  return `M ${scaleX(0, maxMonth)},${baseline} L ${top} L ${scaleX(
    points[points.length - 1].month,
    maxMonth
  )},${baseline} Z`;
}

/**
 * Gráfico de evolução do saldo: a área mais clara representa o total
 * (capital + juros), a área mais escura, sobreposta, representa somente o
 * capital investido — a diferença visível entre as duas é o total de juros
 * acumulados (ETAPA 3: "separação entre capital investido e juros").
 *
 * É decorativo (aria-hidden): os mesmos dados já ficam disponíveis, de
 * forma acessível, na tabela mês a mês exibida logo abaixo.
 */
export function BalanceChart({
  initialAmount,
  months,
}: {
  initialAmount: number;
  months: CompoundInterestMonth[];
}) {
  const points = buildPoints(initialAmount, months);
  const maxMonth = points[points.length - 1]?.month ?? 0;
  const maxValue = Math.max(...points.map((point) => point.total), 1);

  const totalAreaPath = buildAreaPath(points, "total", maxMonth, maxValue);
  const investedAreaPath = buildAreaPath(
    points,
    "invested",
    maxMonth,
    maxValue
  );

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-hidden="true"
      className="h-auto w-full rounded-lg border border-zinc-200 bg-white"
    >
      <path d={totalAreaPath} className="fill-teal-100" />
      <path
        d={investedAreaPath}
        className="fill-teal-700"
      />
    </svg>
  );
}
