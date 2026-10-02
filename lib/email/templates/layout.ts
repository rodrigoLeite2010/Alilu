/**
 * Layout base dos e-mails do Alilu: leve (sem imagens pesadas — só o
 * ícone pequeno), responsivo, estilos inline, cores da marca
 * (--brand-primary #004b5a, --brand-accent #ff9f2a), botão principal e rodapé.
 */

export const EMAIL_BRAND = {
  primary: "#004b5a",
  primarySoft: "#e6f3f5",
  accent: "#ff9f2a",
  text: "#18181b",
  muted: "#52525b",
  siteUrl: "https://alilu.com.br",
  logoUrl: "https://alilu.com.br/logo-icon.png",
};

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface LayoutInput {
  /** Texto curto que aparece na prévia da caixa de entrada. */
  preheader: string;
  heading: string;
  /** HTML já escapado. */
  bodyHtml: string;
  button?: { label: string; url: string } | null;
}

export function renderLayout(input: LayoutInput): string {
  const button = input.button
    ? `<tr><td style="padding:8px 32px 28px">
         <a href="${escapeHtml(input.button.url)}" style="display:inline-block;background:${EMAIL_BRAND.primary};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px">${escapeHtml(input.button.label)}</a>
       </td></tr>`
    : "";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${EMAIL_BRAND.text}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden">
      <tr><td style="background:${EMAIL_BRAND.primary};padding:18px 32px">
        <a href="${EMAIL_BRAND.siteUrl}" style="color:#ffffff;text-decoration:none;font-size:20px;font-weight:700;letter-spacing:0.5px">
          <img src="${EMAIL_BRAND.logoUrl}" width="28" height="28" alt="" style="vertical-align:middle;border-radius:6px;margin-right:8px">ALILU
        </a>
      </td></tr>
      <tr><td style="padding:28px 32px 8px">
        <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:${EMAIL_BRAND.text}">${escapeHtml(input.heading)}</h1>
        <div style="font-size:15px;line-height:1.6;color:${EMAIL_BRAND.text}">${input.bodyHtml}</div>
      </td></tr>
      ${button}
      <tr><td style="border-top:1px solid #e4e4e7;padding:16px 32px;font-size:12px;color:${EMAIL_BRAND.muted}">
        Alilu · <a href="${EMAIL_BRAND.siteUrl}" style="color:${EMAIL_BRAND.primary}">www.alilu.com.br</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
