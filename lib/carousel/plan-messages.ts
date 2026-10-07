/** Mensagens que significam "falta plano/cota do Carrossel Inteligente" — a tela mostra o botão que abre os planos. */
export const CAROUSEL_PLANS_PATH = "/instagram/carrossel-inteligente/planos";

const PLAN_MESSAGE_PATTERNS = [
  /carrossel gr[aá]tis j[aá] foi usado/i,
  /assine um plano do carrossel/i,
  /sem acesso ao carrossel inteligente/i,
  /voc[eê] usou os \d+ carross[eé]is/i,
  /pagamento do carrossel inteligente/i,
  /seu pagamento ainda est[aá] aguardando/i,
  /seu plano permite carross[eé]is para at[eé]/i,
];

export function isCarouselPlanMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  return PLAN_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}
