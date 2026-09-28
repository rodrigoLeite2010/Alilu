/**
 * Eventos anônimos, opcionais, da funcionalidade de doação. O projeto
 * ainda não tem nenhuma plataforma de Analytics integrada — por isso esta
 * função só dispara quando `window.gtag` já existir (ex.: se o Google
 * Analytics for adicionado no futuro), e nunca falha nem bloqueia a
 * experiência de doação caso não exista. NUNCA envia a chave Pix, o nome
 * do recebedor nem qualquer dado financeiro — só o nome do evento.
 */

export type DonationAnalyticsEvent = "donation_opened" | "donation_pix_copied" | "donation_qrcode_viewed";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackDonationEvent(event: DonationAnalyticsEvent): void {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", event);
  } catch {
    // Uma falha aqui nunca deve quebrar a experiência de doação.
  }
}
