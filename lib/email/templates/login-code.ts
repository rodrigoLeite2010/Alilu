import type { RenderedEmail } from "../types";
import { EMAIL_BRAND, escapeHtml, renderLayout } from "./layout";

/** "Seu código de acesso ao Alilu" — só o código, a validade e o aviso. */
export function loginCodeEmail(input: { code: string; expiresInMinutes: number }): RenderedEmail {
  const code = escapeHtml(input.code);
  return {
    subject: "Seu código de acesso ao Alilu",
    html: renderLayout({
      preheader: `Seu código de acesso: ${input.code}`,
      heading: "Olá!",
      bodyHtml: `<p style="margin:0 0 12px">Seu código de acesso é:</p>
<p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px;color:${EMAIL_BRAND.primary}">${code}</p>
<p style="margin:0 0 12px">Ele expira em ${input.expiresInMinutes} minutos.</p>
<p style="margin:0;color:${EMAIL_BRAND.muted}">Se você não solicitou este acesso, ignore este e-mail.</p>`,
    }),
    text: `Olá!\n\nSeu código de acesso é: ${input.code}\n\nEle expira em ${input.expiresInMinutes} minutos.\n\nSe você não solicitou este acesso, ignore este e-mail.\n\nAlilu\nwww.alilu.com.br`,
  };
}
