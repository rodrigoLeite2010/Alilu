"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const HISTORY_LIMIT = 60;
const HISTORY_DEBOUNCE_MS = 700;

/**
 * Desfazer/refazer (ETAPA 5.4) implementado como um hook próprio e simples
 * — o projeto não tinha nenhuma biblioteca de histórico/undo já instalada
 * (ETAPA 10: preferir soluções existentes antes de adicionar dependências),
 * então esta é a "implementação incremental" prevista na própria
 * especificação para este caso.
 *
 * Duas formas de atualizar o estado:
 *   - `commit`: grava um checkpoint de desfazer IMEDIATAMENTE (usado por
 *     ações discretas: trocar template/formato/cor, marcar negrito, enviar
 *     imagem etc.).
 *   - `commitDebounced`: atualiza a prévia a cada chamada (para a digitação
 *     parecer instantânea), mas só grava UM checkpoint de desfazer depois
 *     de uma pausa (ou quando `flushPending` é chamado, ex.: ao soltar o
 *     mouse depois de arrastar um texto) — evita lotar o histórico com um
 *     checkpoint por tecla digitada.
 */
export function useEditorHistory<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const [historyLength, setHistoryLength] = useState({ past: 0, future: 0 });
  const [hasPendingCheckpoint, setHasPendingCheckpoint] = useState(false);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const pendingBaseline = useRef<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const flushPending = useCallback(() => {
    clearTimer();
    if (pendingBaseline.current !== null) {
      past.current.push(pendingBaseline.current);
      if (past.current.length > HISTORY_LIMIT) past.current.shift();
      future.current = [];
      pendingBaseline.current = null;
      setHistoryLength({ past: past.current.length, future: future.current.length });
      setHasPendingCheckpoint(false);
    }
  }, [clearTimer]);

  const commit = useCallback(
    (updater: (prev: T) => T) => {
      flushPending();
      setState((prev) => {
        const next = updater(prev);
        if (Object.is(next, prev)) return prev;
        past.current.push(prev);
        if (past.current.length > HISTORY_LIMIT) past.current.shift();
        future.current = [];
        setHistoryLength({ past: past.current.length, future: future.current.length });
        return next;
      });
    },
    [flushPending]
  );

  const commitDebounced = useCallback(
    (updater: (prev: T) => T) => {
      setState((prev) => {
        if (pendingBaseline.current === null) {
          pendingBaseline.current = prev;
          setHasPendingCheckpoint(true);
        }
        return updater(prev);
      });
      clearTimer();
      timerRef.current = setTimeout(flushPending, HISTORY_DEBOUNCE_MS);
    },
    [clearTimer, flushPending]
  );

  const undo = useCallback(() => {
    flushPending();
    if (past.current.length === 0) return;
    setState((prev) => {
      const previous = past.current.pop();
      if (previous === undefined) return prev;
      future.current.push(prev);
      setHistoryLength({ past: past.current.length, future: future.current.length });
      return previous;
    });
  }, [flushPending]);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    setState((prev) => {
      const next = future.current.pop();
      if (next === undefined) return prev;
      past.current.push(prev);
      setHistoryLength({ past: past.current.length, future: future.current.length });
      return next;
    });
  }, []);

  const resetHistory = useCallback((nextState: T) => {
    clearTimer();
    pendingBaseline.current = null;
    past.current = [];
    future.current = [];
    setState(nextState);
    setHistoryLength({ past: 0, future: 0 });
    setHasPendingCheckpoint(false);
  }, [clearTimer]);

  return {
    state,
    commit,
    commitDebounced,
    flushPending,
    undo,
    redo,
    resetHistory,
    canUndo: historyLength.past > 0 || hasPendingCheckpoint,
    canRedo: historyLength.future > 0,
  };
}
