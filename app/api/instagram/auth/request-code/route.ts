import { NextResponse } from "next/server";
import { OtpRateLimitError, requestOtp } from "@/lib/instagram/backend/otp-service";
import { isValidEmail, normalizeEmail } from "@/lib/instagram/backend/otp";
import { sendOtpEmail } from "@/lib/email/resend";

/**
 * Pede um código de login de 6 dígitos por e-mail (ETAPA de autenticação,
 * Fase 3). Sempre responde de forma genérica em caso de erro de envio —
 * nunca expõe detalhes internos (chave do Resend, stack trace, etc.) na
 * resposta HTTP, e nunca loga o código gerado.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const rawEmail = (body as { email?: unknown } | null)?.email;
  const email = typeof rawEmail === "string" ? rawEmail : "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
  }

  try {
    const { code } = await requestOtp(email);
    await sendOtpEmail(normalizeEmail(email), code);
  } catch (error) {
    if (error instanceof OtpRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    console.error("[instagram/auth/request-code] falha ao gerar ou enviar código", error);
    return NextResponse.json(
      { error: "Não foi possível enviar o código agora. Tente novamente em instantes." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
