export const DEFAULT_CALLBACK = "/instagram/painel";

/**
 * Só aceita destino interno ("/algo"), nunca "//host", "/\\host", "https://..." ou "javascript:".
 * Sem isso, /entrar?callbackUrl=... vira redirecionamento aberto (phishing) ou execução de script.
 */
export function safeCallbackUrl(raw: string | null | undefined): string {
  if (!raw || raw.length > 500) return DEFAULT_CALLBACK;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return DEFAULT_CALLBACK;
  if (/[\u0000-\u001f\\]/.test(raw)) return DEFAULT_CALLBACK;
  return raw;
}

/** Navegador embutido de app (Instagram, Facebook, TikTok...): o Google bloqueia login nele (403 disallowed_useragent). */
export function isInAppBrowser(userAgent: string): boolean {
  return /Instagram|FBAN|FBAV|FB_IAB|FBIOS|musical_ly|BytedanceWebview|TikTok|Line\//i.test(userAgent);
}
