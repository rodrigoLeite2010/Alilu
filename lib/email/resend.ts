import "server-only";
import { sendEmail } from "./email-service";
import { loginCodeEmail } from "./templates/login-code";
import { OTP_EXPIRY_MINUTES } from "@/lib/instagram/backend/otp";

/**
 * Compatibilidade: a rota de login chama sendOtpEmail(to, code). O envio
 * agora passa pelo EmailService central (template com a marca, log de
 * entrega, provedor Resend) — sem logar o código.
 */
export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const email = loginCodeEmail({ code, expiresInMinutes: OTP_EXPIRY_MINUTES });
  const result = await sendEmail({ ...email, to, type: "LOGIN_CODE" });
  if (!result.ok) {
    // Nunca o código nem o destinatário — só a razão vinda do provedor.
    throw new Error(`Falha ao enviar o código de login: ${result.error ?? "erro"}`);
  }
}
