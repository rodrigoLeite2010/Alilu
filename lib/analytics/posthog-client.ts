/**
 * Analytics do Alilu (PostHog Cloud) — SOMENTE no navegador, sempre "best-effort":
 * qualquer falha aqui é engolida e nunca atrapalha a página, o login ou a publicação.
 *
 * Privacidade: nada de query string (pode ter ?code= do OAuth, tokens, e-mail), nada de
 * conteúdo do usuário. Só pathname, referrer sem query e o id interno do usuário.
 */
import type { PostHog } from "posthog-js";

export const POSTHOG_DEFAULT_HOST = "https://us.i.posthog.com";
/** Propriedade de ambiente enviada em todo evento; as consultas do admin filtram por ela. */
export const ANALYTICS_ENVIRONMENT = "production";

export interface AnalyticsEnv {
  key: string | undefined;
  host: string | undefined;
  nodeEnv: string | undefined;
  hostname: string | undefined;
}

/** Só liga em produção, com chave, fora de localhost/IPs locais (não contamina os dados de produção). */
export function shouldEnableAnalytics(env: AnalyticsEnv): boolean {
  if (!env.key || env.nodeEnv !== "production") return false;
  const hostname = (env.hostname ?? "").toLowerCase();
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") return false;
  if (hostname.endsWith(".localhost") || hostname.endsWith(".local")) return false;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) return false;
  return true;
}

/** Remove query string e hash de uma URL (ou caminho). */
export function stripQuery(url: string): string {
  if (!url) return url;
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

let instance: Promise<PostHog | null> | null = null;

/** Carrega e inicializa o PostHog UMA vez (import dinâmico: não bloqueia a renderização). */
export function loadPostHog(): Promise<PostHog | null> {
  if (instance) return instance;
  instance = (async () => {
    try {
      if (typeof window === "undefined") return null;
      const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
      if (!shouldEnableAnalytics({ key, host: process.env.NEXT_PUBLIC_POSTHOG_HOST, nodeEnv: process.env.NODE_ENV, hostname: window.location.hostname })) {
        return null;
      }
      const { default: posthog } = await import("posthog-js");
      posthog.init(key as string, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || POSTHOG_DEFAULT_HOST,
        capture_pageview: false, // pageviews manuais (rotas do App Router) — sem duplicar
        capture_pageleave: true,
        autocapture: false, // sem rastrear cliques/campos
        disable_session_recording: true,
        person_profiles: "identified_only",
        persistence: "localStorage+cookie",
        sanitize_properties: (properties) => {
          const clean = { ...properties };
          for (const field of ["$current_url", "$referrer", "$initial_referrer", "$referring_domain"]) {
            if (typeof clean[field] === "string") clean[field] = stripQuery(clean[field] as string);
          }
          return clean;
        },
      });
      posthog.register({ environment: ANALYTICS_ENVIRONMENT, logged_in: false });
      return posthog;
    } catch {
      return null;
    }
  })();
  return instance;
}

/** Visualização de página (rota). Só pathname — sem query string. */
export async function trackPageView(pathname: string): Promise<void> {
  try {
    const posthog = await loadPostHog();
    if (!posthog) return;
    posthog.capture("$pageview", {
      $current_url: `${window.location.origin}${stripQuery(pathname)}`,
      $pathname: stripQuery(pathname),
    });
  } catch {
    // analytics nunca quebra o site
  }
}

/** Usuário logado: identifica pelo id interno (nunca e-mail/CPF). Dispara user_login só na transição anônimo → logado. */
export async function identifyUser(user: { id: string; isAdmin?: boolean }): Promise<void> {
  try {
    const posthog = await loadPostHog();
    if (!posthog || !user.id) return;
    const wasIdentified = posthog.get_distinct_id() === user.id;
    if (!wasIdentified) posthog.identify(user.id, { role: user.isAdmin ? "admin" : "user", isAdmin: user.isAdmin === true });
    posthog.register({ logged_in: true });
    if (!wasIdentified) posthog.capture("user_login");
  } catch {
    // best-effort
  }
}

/** Sessão acabou (sem login): se o navegador ainda estava identificado, zera para não misturar usuários. */
export async function resetIfIdentified(): Promise<void> {
  try {
    const posthog = await loadPostHog();
    if (!posthog) return;
    if (posthog.get_property("$user_state") === "identified") {
      posthog.reset();
      posthog.register({ environment: ANALYTICS_ENVIRONMENT, logged_in: false });
    }
  } catch {
    // best-effort
  }
}

/**
 * Chamar ANTES de signOut(): registra user_logout, envia na hora e reseta a identificação.
 * Espera no máximo ~600 ms — o logout nunca fica preso por causa do analytics.
 */
export async function trackLogoutAndReset(): Promise<void> {
  const work = (async () => {
    try {
      const posthog = await loadPostHog();
      if (!posthog) return;
      posthog.capture("user_logout", undefined, { send_instantly: true });
      posthog.reset();
      posthog.register({ environment: ANALYTICS_ENVIRONMENT, logged_in: false });
    } catch {
      // best-effort
    }
  })();
  await Promise.race([work, new Promise<void>((resolve) => setTimeout(resolve, 600))]);
}

/** Só para testes. */
export function __resetAnalyticsForTests(): void {
  instance = null;
}
