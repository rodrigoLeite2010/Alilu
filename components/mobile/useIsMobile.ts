"use client";

import { useSyncExternalStore } from "react";

/** Mesmo corte do Tailwind `md` (768px): abaixo disso é "mobile". */
const MOBILE_QUERY = "(max-width: 767px)";

function getMatchMedia(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(MOBILE_QUERY);
}

function subscribe(onChange: () => void) {
  const query = getMatchMedia();
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

/**
 * Só para decisões que o CSS não resolve (ex.: não buscar dados que só a
 * tela mobile mostra). Layout e visibilidade continuam sendo feitos com
 * classes responsivas (`md:hidden`, `hidden md:block`). No servidor e na
 * hidratação devolve `false`, então a primeira renderização é idêntica nos
 * dois lados.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getMatchMedia()?.matches ?? false,
    () => false,
  );
}
