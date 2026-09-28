"use client";

import { useEffect, useState } from "react";
import { FINANCE_CHANGED_EVENT, financeApi, type MonthData } from "./api";

/** Carrega o mês e recarrega sozinho quando qualquer tela salva algo. */
export function useMonthData(month: string) {
  const [loaded, setLoaded] = useState<MonthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    financeApi
      .loadMonth(month)
      .then((result) => {
        if (cancelled) return;
        setLoaded(result);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Não foi possível carregar.");
      });
    return () => {
      cancelled = true;
    };
  }, [month, tick]);

  useEffect(() => {
    const handler = () => setTick((value) => value + 1);
    window.addEventListener(FINANCE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(FINANCE_CHANGED_EVENT, handler);
  }, []);

  // Dados de outro mês (durante a troca) contam como "carregando".
  const data = loaded && loaded.month === month ? loaded : null;
  return { data, error, loading: data === null && error === null };
}
