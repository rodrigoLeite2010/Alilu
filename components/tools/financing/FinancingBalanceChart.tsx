import type { FinancingInstallment } from "@/lib/calculators/financing";

const WIDTH = 600;
const HEIGHT = 220;
const PADDING = 8;

interface Series {
  key: "price" | "sac";
  label: string;
  installments: FinancingInstallment[];
  className: string;
}

function scaleX(month: number, maxMonth: number): number {
  if (maxMonth === 0) return PADDING;
  return PADDING + (month / maxMonth) * (WIDTH - PADDING * 2);
}

function scaleY(value: number, maxValue: number): number {
  if (maxValue === 0) return HEIGHT - PADDING;
  return HEIGHT - PADDING - (value / maxValue) * (HEIGHT - PADDING * 2);
}

function buildLinePath(
  financedAmount: number,
  installments: FinancingInstallment[],
  maxMonth: number,
  maxValue: number
): string {
  const points = [
    { month: 0, balance: financedAmount },
    ...installments.map((row) => ({ month: row.number, balance: row.balance })),
  ];

  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${scaleX(point.month, maxMonth)},${scaleY(
          Math.max(point.balance, 0),
          maxValue
        )}`
    )
    .join("");
}

/**
 * Gráfico de evolução do saldo devedor (ETAPA 4, "RESULTADO"). Reaproveita
 * a mesma técnica de SVG artesanal, sem dependência nova, criada para a
 * Calculadora de Juros Compostos (ETAPA 3) — aqui como linhas (uma por
 * sistema simulado), já que o objetivo é comparar Price e SAC lado a lado
 * quando ambos estão presentes.
 *
 * É decorativo (aria-hidden): os mesmos dados já ficam disponíveis, de
 * forma acessível, nas tabelas de amortização exibidas logo abaixo.
 */
export function FinancingBalanceChart({
  financedAmount,
  price,
  sac,
}: {
  financedAmount: number;
  price?: FinancingInstallment[];
  sac?: FinancingInstallment[];
}) {
  const series: Series[] = [
    price
      ? {
          key: "price",
          label: "Price",
          installments: price,
          className: "stroke-teal-700",
        }
      : null,
    sac
      ? {
          key: "sac",
          label: "SAC",
          installments: sac,
          className: "stroke-emerald-600",
        }
      : null,
  ].filter((item): item is Series => item !== null);

  const maxMonth = Math.max(
    ...series.map((s) => s.installments.length),
    1
  );
  const maxValue = Math.max(financedAmount, 1);

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-hidden="true"
        className="h-auto w-full rounded-lg border border-zinc-200 bg-white"
      >
        {series.map((s) => (
          <path
            key={s.key}
            d={buildLinePath(financedAmount, s.installments, maxMonth, maxValue)}
            fill="none"
            strokeWidth={2.5}
            className={s.className}
          />
        ))}
      </svg>
      {series.length > 1 ? (
        <ul className="mt-2 flex gap-4 text-xs text-zinc-600" aria-hidden="true">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${s.className.replaceAll("stroke-", "bg-")}`}
              />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
