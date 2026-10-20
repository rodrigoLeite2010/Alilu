"use client";

import { Button } from "@/components/ui/Button";
import { BulkCheckbox } from "./BulkCheckbox";
import type { BulkSelection } from "./useBulkSelection";

/**
 * Barra padrão de seleção em massa: "Selecionar todos", contador,
 * "Desmarcar todos" e "Excluir selecionados (N)" (desabilitado sem seleção).
 * Se o filtro tem mais itens do que os visíveis (ex.: um dia aberto no
 * calendário), mostra o atalho "Selecionar todos os N do filtro".
 */
export function BulkActionBar({
  selection,
  visibleCount,
  onDelete,
  deleteLabel = "Excluir selecionados",
  noun = { singular: "item", plural: "itens" },
  busy = false,
}: {
  selection: BulkSelection;
  visibleCount: number;
  onDelete: () => void;
  deleteLabel?: string;
  noun?: { singular: string; plural: string; selectedSingular?: string; selectedPlural?: string };
  busy?: boolean;
}) {
  if (visibleCount === 0) return null;
  const { count } = selection;
  const selectedWord = count === 1 ? (noun.selectedSingular ?? "selecionado") : (noun.selectedPlural ?? "selecionados");
  const canSelectFiltered = selection.scopeCount > visibleCount && selection.count < selection.scopeCount && selection.allSelected;

  return (
    <div
      role="toolbar"
      aria-label="Ações em massa"
      className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-200 bg-white/95 px-1 py-1 backdrop-blur sm:px-2"
    >
      <label className="flex min-h-11 cursor-pointer items-center gap-1 text-sm font-medium text-zinc-800">
        <BulkCheckbox
          checked={selection.allSelected}
          indeterminate={selection.someSelected}
          onChange={selection.allSelected ? selection.clear : selection.selectAll}
          label="Selecionar todos"
          disabled={busy}
        />
        <span>Selecionar todos</span>
      </label>
      <p role="status" aria-live="polite" className="text-sm text-zinc-600">
        {count === 0 ? `${visibleCount} ${visibleCount === 1 ? noun.singular : noun.plural}` : `${count} ${count === 1 ? noun.singular : noun.plural} ${selectedWord}`}
      </p>
      {canSelectFiltered ? (
        <button type="button" onClick={selection.selectAllInScope} className="text-sm text-teal-800 underline">
          Selecionar todos os {selection.scopeCount} do filtro
        </button>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        {count > 0 ? (
          <Button type="button" variant="ghost" onClick={selection.clear} disabled={busy}>
            Desmarcar todos
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          disabled={count === 0 || busy}
          onClick={onDelete}
          className="text-red-700 ring-red-300 hover:bg-red-50"
        >
          {deleteLabel}
          {count > 0 ? ` (${count})` : ""}
        </Button>
      </div>
    </div>
  );
}
