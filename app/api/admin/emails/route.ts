import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/admin-access";
import { EmailNotConfiguredError } from "@/lib/email/config";
import { sendEmail } from "@/lib/email/email-service";
import { adminTestEmail } from "@/lib/email/templates/agenda";

export const dynamic = "force-dynamic";

/**
 * POST { action: "test" } — envia um e-mail de teste para o PRÓPRIO admin logado
 * (nunca para um endereço informado pelo navegador). Só ADMIN_EMAILS.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== "test") return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  try {
    const email = adminTestEmail();
    const result = await sendEmail({ to: admin.email, type: "ADMIN_TEST", userId: admin.userId, ...email });
    if (!result.ok) return NextResponse.json({ error: `O provedor recusou o envio: ${result.error ?? "erro desconhecido"}` }, { status: 502 });
    return NextResponse.json({ sent: true, to: admin.email, providerMessageId: result.providerMessageId });
  } catch (error) {
    console.error(JSON.stringify({ scope: "email", event: "admin_test.crash", error: (error as Error).name }));
    const message = error instanceof EmailNotConfiguredError ? "E-mail não configurado (EMAIL_FROM / RESEND_API_KEY)." : "Falha ao enviar o teste.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
