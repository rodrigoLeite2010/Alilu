import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { CreditPurchaseError, startCreditCheckout } from "@/lib/ai-video/backend/credit-purchase-service";
import { AsaasApiError, AsaasConfigError } from "@/lib/billing/backend/asaas-client";

/**
 * POST { packageCode, name?, cpfCnpj?, email? }: cria a cobrança no Asaas e
 * devolve o link de pagamento. NÃO credita nada — só o Webhook confirmado.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = ((await request.json()) as Record<string, unknown>) ?? {};
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  try {
    const result = await startCreditCheckout(userId, {
      packageCode: String(body.packageCode ?? ""),
      name: typeof body.name === "string" ? body.name : "",
      cpfCnpj: typeof body.cpfCnpj === "string" ? body.cpfCnpj : "",
      email: typeof body.email === "string" ? body.email : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CreditPurchaseError) return NextResponse.json({ error: error.message }, { status: error.httpStatus });
    if (error instanceof AsaasApiError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof AsaasConfigError) {
      return NextResponse.json({ error: "Pagamentos temporariamente indisponíveis. Tente novamente mais tarde." }, { status: 503 });
    }
    console.error(JSON.stringify({ scope: "ai-video", event: "checkout.crash", message: (error as Error)?.message }));
    return NextResponse.json({ error: "Não foi possível iniciar o pagamento." }, { status: 500 });
  }
}
