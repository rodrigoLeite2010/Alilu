import "server-only";
import { Resend } from "resend";

/**
 * Envio de e-mail transacional (hoje, só o código de login) via Resend.
 * Cliente criado sob demanda (nunca no carregamento do módulo) para não
 * exigir RESEND_API_KEY em contextos que importam este arquivo sem chegar
 * a enviar e-mail (ex.: build, testes de outros módulos).
 */

let cachedClient: Resend | null = null;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY não está configurada — necessária para enviar o código de login por e-mail.",
    );
  }
  if (!cachedClient) {
    cachedClient = new Resend(apiKey);
  }
  return cachedClient;
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error("RESEND_FROM_EMAIL não está configurada.");
  }

  const client = getResendClient();
  const { error } = await client.emails.send({
    from,
    to,
    subject: `${code} é o seu código de login — ALILU`,
    text:
      `Seu código de login é: ${code}\n\n` +
      "Ele expira em 10 minutos. Se você não pediu esse código, pode ignorar este e-mail.",
    html:
      `<p>Seu código de login é: <strong style="font-size:20px;letter-spacing:2px">${code}</strong></p>` +
      "<p>Ele expira em 10 minutos. Se você não pediu esse código, pode ignorar este e-mail.</p>",
  });

  if (error) {
    // Nunca logar o código nem o e-mail de destino aqui — só a razão da
    // falha, que vem do próprio Resend.
    throw new Error(`Falha ao enviar e-mail de login via Resend: ${error.message}`);
  }
}
