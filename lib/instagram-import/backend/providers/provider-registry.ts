import "server-only";
import type { InstagramMediaImportProvider } from "./provider";
import { apifyInstagramProvider } from "./apify-provider";

/** Provedor ativo (troca sem mexer no resto). Hoje: Apify. */
let override: InstagramMediaImportProvider | null = null;

export function getInstagramImportProvider(): InstagramMediaImportProvider {
  return override ?? apifyInstagramProvider;
}

/** Só para testes. */
export function __setInstagramImportProviderForTests(provider: InstagramMediaImportProvider | null): void {
  override = provider;
}
