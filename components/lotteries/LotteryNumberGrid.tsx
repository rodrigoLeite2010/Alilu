"use client";

export interface LotteryNumberGridProps {
  minNumber: number;
  maxNumber: number;
  columns?: number;
  /** Números destacados (selecionados ou parte de um jogo já gerado). */
  selected?: ReadonlySet<number> | readonly number[];
  /** Números que não podem ser clicados neste grid (ex.: já escolhidos no grid "oposto"). */
  disabledNumbers?: ReadonlySet<number> | readonly number[];
  /** Presente = grid interativo (clicável); ausente = só exibição (resultado de um jogo gerado). */
  onToggle?: (n: number) => void;
  size?: "sm" | "md";
  ariaLabel: string;
}

function toSet(value?: ReadonlySet<number> | readonly number[]): Set<number> {
  if (!value) return new Set();
  return value instanceof Set ? new Set(value) : new Set(value);
}

const SIZE_CLASSES: Record<"sm" | "md", string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm sm:h-11 sm:w-11",
};

/**
 * Representação visual do volante da Lotofácil (Seção 13 do pedido): uma
 * bolinha por número, de `minNumber` a `maxNumber`. Sem `onToggle` é só
 * exibição (usado para mostrar um jogo já gerado); com `onToggle` vira um
 * seletor clicável (usado no modo Personalizado, para marcar números
 * obrigatórios/excluídos). Não imita o layout oficial do volante da CAIXA
 * — usa a identidade visual do Alilu (bolinhas arredondadas, cor teal).
 */
export function LotteryNumberGrid({
  minNumber,
  maxNumber,
  columns = 5,
  selected,
  disabledNumbers,
  onToggle,
  size = "md",
  ariaLabel,
}: LotteryNumberGridProps) {
  const selectedSet = toSet(selected);
  const disabledSet = toSet(disabledNumbers);
  const numbers = Array.from({ length: maxNumber - minNumber + 1 }, (_, i) => minNumber + i);
  const interactive = Boolean(onToggle);

  return (
    <ul
      aria-label={ariaLabel}
      className="grid gap-1.5 sm:gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {numbers.map((n) => {
        const isSelected = selectedSet.has(n);
        const isDisabled = disabledSet.has(n);
        const label = String(n).padStart(2, "0");

        if (!interactive) {
          return (
            <li key={n} className="flex justify-center">
              <span
                className={`flex ${SIZE_CLASSES[size]} items-center justify-center rounded-full font-semibold ${
                  isSelected ? "bg-teal-700 text-white" : "bg-zinc-100 text-zinc-400"
                }`}
              >
                {label}
              </span>
            </li>
          );
        }

        return (
          <li key={n} className="flex justify-center">
            <button
              type="button"
              onClick={() => onToggle?.(n)}
              disabled={isDisabled}
              aria-pressed={isSelected}
              aria-label={`${label}${isSelected ? " (selecionado)" : ""}`}
              className={`flex ${SIZE_CLASSES[size]} items-center justify-center rounded-full font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-30 ${
                isSelected ? "bg-teal-700 text-white hover:bg-teal-800" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
