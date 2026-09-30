import { NextResponse } from "next/server";
import {
  AsaasWebhookAuthError,
  AsaasWebhookPayloadError,
  assertValidWebhookToken,
  processAsaasWebhookEvent,
} from "@/lib/billing/backend/asaas-webhook-service";

export const dynamic = "force-dynamic";

/**
 * Endpoint público chamado pelo Asaas (Sandbox ou produção) a cada
 * evento de pagamento/assinatura do Piloto Automático — cadastrado
 * manualmente no dashboard do Asaas (ver .env.example para a URL e o
 * authToken a configurar lá). NUNCA é chamado pelo navegador do
 * usuário — é a ÚNICA forma de liberar acesso por pagamento confirmado
 * (nunca por um redirect da página de pagamento).
 *
 * Sempre responde 200 quando o evento foi recebido e gravado (mesmo que
 * duplicado, ou de um tipo fora do escopo do MVP) — só token inválido
 * (401) e corpo ilegível (400) não são 200, para o Asaas tentar de novo
 * nesses casos.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const providedToken = request.headers.get("asaas-access-token");
  try {
    assertValidWebhookToken(providedToken);
  } catch (error) {
    if (error instanceof AsaasWebhookAuthError) {
      console.error(JSON.stringify({ scope: "billing", event: "webhook.auth_failed" }));
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  try {
    const result = await processAsaasWebhookEvent(body);
    console.info(
      JSON.stringify({
        scope: "billing",
        event: "webhook.received",
        status: result.status,
        eventType: result.eventType,
      }),
    );
    return NextResponse.json({ received: true, status: result.status });
  } catch (error) {
    if (error instanceof AsaasWebhookPayloadError) {
      return NextResponse.json({ error: "Corpo do evento em formato inesperado." }, { status: 400 });
    }
    console.error(
      JSON.stringify({ scope: "billing", event: "webhook.crash", message: (error as Error)?.message }),
    );
    // 500 de propósito: o Asaas reentrega o evento em caso de erro de
    // servidor — melhor isso do que responder 200 e perder o evento.
    return NextResponse.json({ error: "Falha ao processar o evento." }, { status: 500 });
  }
}
