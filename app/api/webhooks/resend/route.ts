import { NextResponse } from "next/server";
import { processResendWebhookEvent, verifyResendWebhook, WebhookSignatureError } from "@/lib/email/webhook-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/resend — eventos de entrega da Resend. Só aceita com
 * assinatura Svix válida (RESEND_WEBHOOK_SECRET); repetição do mesmo
 * svix-id é ignorada (200, para a Resend parar de reenviar).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const headers = {
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
  };
  let event;
  try {
    event = verifyResendWebhook(rawBody, headers);
  } catch (error) {
    if (error instanceof WebhookSignatureError) return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    throw error;
  }
  try {
    const status = await processResendWebhookEvent(headers.id as string, event);
    return NextResponse.json({ status });
  } catch (error) {
    console.error(JSON.stringify({ scope: "email", event: "webhook_failed", message: (error as Error)?.message?.slice(0, 300) }));
    return NextResponse.json({ error: "Falha ao processar." }, { status: 500 });
  }
}
