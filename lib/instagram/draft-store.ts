"use client";

/**
 * Rascunho local da criação de publicação (Posts Virais), guardado no
 * IndexedDB do próprio navegador para sobreviver ao redirecionamento de
 * login no Alilu e de conexão com o Instagram — sem perder template,
 * imagem, legenda, data e horário.
 *
 * Guarda só conteúdo do usuário (estado do editor, legenda, imagem como
 * Blob). NUNCA tokens ou credenciais. Expira em 24h. Se o IndexedDB não
 * estiver disponível (aba anônima restrita etc.), tudo vira no-op.
 */

import type { SerializedEditorState } from "@/lib/instagram/editor-state";

const DB_NAME = "alilu-instagram";
const STORE = "drafts";
/** Um rascunho por origem: "viral-post", "post" (Criador de Posts), "carousel", "reel". */
export type DraftKind = "viral-post" | "post" | "carousel" | "reel";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface LocalPublicationDraft {
  viralTemplateId: string | null;
  editor: SerializedEditorState;
  caption: string;
  mode: "now" | "schedule";
  schedule: { date: string; time: string };
  image: Blob | null;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    } finally {
      db.close();
    }
  });
}

export async function saveLocalDraft(
  draft: Omit<LocalPublicationDraft, "savedAt">,
  kind: DraftKind = "viral-post",
): Promise<void> {
  await withStore("readwrite", (store) => store.put({ ...draft, savedAt: Date.now() }, kind));
}

export async function loadLocalDraft(kind: DraftKind = "viral-post"): Promise<LocalPublicationDraft | null> {
  const draft = await withStore<LocalPublicationDraft>("readonly", (store) => store.get(kind));
  if (!draft || Date.now() - draft.savedAt > MAX_AGE_MS) return null;
  return draft;
}

export async function clearLocalDraft(kind: DraftKind = "viral-post"): Promise<void> {
  await withStore("readwrite", (store) => store.delete(kind));
}

/** Rascunho genérico (ex.: carrossel com vários slides e imagens). */
export async function saveLocalValue<T>(kind: DraftKind, value: T): Promise<void> {
  await withStore("readwrite", (store) => store.put({ value, savedAt: Date.now() }, kind));
}

export async function loadLocalValue<T>(kind: DraftKind): Promise<T | null> {
  const stored = await withStore<{ value: T; savedAt: number }>("readonly", (store) => store.get(kind));
  if (!stored || Date.now() - stored.savedAt > MAX_AGE_MS) return null;
  return stored.value;
}
