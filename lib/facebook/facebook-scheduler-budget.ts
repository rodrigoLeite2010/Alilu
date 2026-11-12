/**
 * Orçamento de tempo do Facebook dentro da rota do cron (que roda o
 * Instagram primeiro e depois o Facebook, numa função com maxDuration).
 * Módulo puro, sem dependências de servidor.
 */

/** Orçamento padrão do Facebook dentro da rota do cron. */
export const FACEBOOK_SCHEDULER_BUDGET_MS = 15_000;
/** Margem para o Facebook terminar o destino que começou antes do limite da função (maxDuration). */
const FACEBOOK_FUNCTION_SAFETY_MS = 25_000;

/**
 * Quanto tempo o Facebook ainda pode usar para COMEÇAR novos destinos na
 * mesma execução do cron, depois do Instagram. Se o Instagram consumiu
 * quase todo o maxDuration, devolve 0: o Facebook não inicia nada agora
 * (não corre o risco de ser interrompido no meio de um POST) e o próximo
 * disparo do cron publica. Nunca afeta o Instagram.
 */
export function facebookSchedulerBudget(routeStartedAt: number, maxDurationMs: number, now: number = Date.now()): number {
  const remaining = maxDurationMs - (now - routeStartedAt) - FACEBOOK_FUNCTION_SAFETY_MS;
  return Math.max(0, Math.min(FACEBOOK_SCHEDULER_BUDGET_MS, remaining));
}
