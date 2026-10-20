"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Estado de seleção em massa de uma lista.
 * - `scopeIds`: tudo o que pode ser selecionado no filtro atual. A seleção
 *   efetiva é sempre a interseção com o escopo: itens excluídos ou que
 *   saíram do filtro deixam de contar, então o contador nunca inclui o
 *   que o usuário não vê mais.
 * - `visibleIds`: o que está na tela agora (ex.: um dia do calendário);
 *   "Selecionar todos" marca estes. Por padrão, igual ao escopo.
 */
export function useBulkSelection(scopeIds: string[], visibleIds: string[] = scopeIds) {
  const [raw, setRaw] = useState<Set<string>>(new Set());
  const scopeKey = scopeIds.join("|");
  const scope = useMemo(() => new Set(scopeIds), [scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = useMemo(() => new Set([...raw].filter((id) => scope.has(id))), [raw, scope]);

  const toggle = useCallback((id: string) => {
    setRaw((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const visibleKey = visibleIds.join("|");
  const selectAll = useCallback(
    () => setRaw((current) => new Set([...current, ...visibleIds])),
    [visibleKey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const selectAllInScope = useCallback(() => setRaw(new Set(scopeIds)), [scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const clear = useCallback(() => setRaw(new Set()), []);

  const count = selected.size;
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  return {
    selected,
    selectedIds: [...selected],
    count,
    isSelected: (id: string) => selected.has(id),
    allSelected: allVisibleSelected,
    someSelected: !allVisibleSelected && visibleIds.some((id) => selected.has(id)),
    scopeCount: scopeIds.length,
    toggle,
    selectAll,
    selectAllInScope,
    clear,
  };
}

export type BulkSelection = ReturnType<typeof useBulkSelection>;
