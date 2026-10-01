import "server-only";
import type { ImageToVideoProvider } from "./provider";
import { runwayImageToVideoProvider } from "./runway-provider";
import { falImageToVideoProvider } from "./fal-provider";

/**
 * Provedores disponíveis, por id (o mesmo gravado em
 * ai_video_model_pricing.provider). Preparado para o "AI video router"
 * futuro (escolher o mais barato saudável) — hoje a escolha é só pela
 * linha de preço ativa da qualidade escolhida. Um fallback automático para
 * um provedor MAIS CARO nunca é feito aqui: precisaria passar de novo pela
 * trava de preço (generation-service.ts).
 */
const PROVIDERS: Record<string, ImageToVideoProvider> = {
  runway: runwayImageToVideoProvider,
  fal: falImageToVideoProvider,
};

let override: Record<string, ImageToVideoProvider> | null = null;

export function getImageToVideoProvider(providerId: string): ImageToVideoProvider | null {
  return (override ?? PROVIDERS)[providerId] ?? null;
}

/** Só para testes: troca os provedores por fakes. */
export function __setImageToVideoProvidersForTests(providers: Record<string, ImageToVideoProvider> | null): void {
  override = providers;
}
