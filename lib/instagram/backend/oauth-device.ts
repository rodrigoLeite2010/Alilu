/**
 * Classificação leve do navegador para diagnóstico do OAuth mobile.
 * Nunca bloqueia fluxo por user agent; serve só para enxergar padrões.
 */

export interface OAuthDeviceHint {
  userAgent: string | null;
  isMobile: boolean;
  browser: "instagram-in-app" | "samsung-internet" | "chrome-android" | "safari-ios" | "chrome-ios" | "desktop" | "mobile-other" | "unknown";
}

export function getOAuthDeviceHint(userAgent: string | null | undefined): OAuthDeviceHint {
  const ua = userAgent?.slice(0, 300) || null;
  if (!ua) return { userAgent: null, isMobile: false, browser: "unknown" };

  const lower = ua.toLowerCase();
  const isAndroid = lower.includes("android");
  const isIos = /\b(iphone|ipad|ipod)\b/i.test(ua);
  const isMobile = isAndroid || isIos || lower.includes("mobile");

  let browser: OAuthDeviceHint["browser"] = isMobile ? "mobile-other" : "desktop";
  if (lower.includes("instagram")) browser = "instagram-in-app";
  else if (lower.includes("samsungbrowser")) browser = "samsung-internet";
  else if (isAndroid && lower.includes("chrome")) browser = "chrome-android";
  else if (isIos && lower.includes("crios")) browser = "chrome-ios";
  else if (isIos && lower.includes("safari")) browser = "safari-ios";

  return { userAgent: ua, isMobile, browser };
}
