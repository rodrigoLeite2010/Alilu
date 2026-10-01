import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { CreditPurchaseError, requestPurchaseRefund } from "@/lib/ai-video/backend/credit-purchase-service";

/** POST { purchaseId }: reembolso de uma compra com créditos ainda não usados, dentro do prazo. */
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
    const purchase = await requestPurchaseRefund(userId, String(body.purchaseId ?? ""));
    return NextResponse.json({ status: purchase.status });
  } catch (error) {
    if (error instanceof CreditPurchaseError) return NextResponse.json({ error: error.message }, { status: error.httpStatus });
    console.error(JSON.stringify({ scope: "ai-video", event: "refund.crash", message: (error as Error)?.message }));
    return NextResponse.json({ error: "Não foi possível processar o reembolso." }, { status: 500 });
  }
}
