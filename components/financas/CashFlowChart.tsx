import type { CashFlowPoint } from "@/lib/financas/summary";
import { money, shortDate } from "./format";

/** Linha simples (SVG) do saldo projetado por dia. Sem biblioteca de gráficos. */
export function CashFlowChart({ points }: { points: CashFlowPoint[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-zinc-500">Sem dias restantes neste mês para projetar.</p>;
  }
  const width = 600;
  const height = 160;
  const pad = 8;
  const values = points.map((p) => p.balanceCents);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (points.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.balanceCents).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Saldo projetado de ${shortDate(points[0].date)} a ${shortDate(last.date)}, terminando em ${money(last.balanceCents)}`}
        className="h-40 w-full"
      >
        <line x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} stroke="currentColor" strokeDasharray="4 4" className="text-zinc-300" />
        <path d={path} fill="none" strokeWidth={2.5} strokeLinejoin="round" className={last.balanceCents < 0 ? "stroke-red-600" : "stroke-teal-700"} />
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-zinc-500">
        <span>{shortDate(points[0].date)}</span>
        <span>Saldo previsto em {shortDate(last.date)}: {money(last.balanceCents)}</span>
      </figcaption>
    </figure>
  );
}
