import { NextResponse } from "next/server";
import { applyDebtPayment } from "@/lib/financas/backend/repository";
import { isUuid, requireUserId } from "@/lib/financas/backend/session";
import { parseDelta } from "@/lib/financas/validation";

type Context = { params: Promise<{ id: string }> };

/** POST { deltaCents } — reduz o saldo devedor (positivo, pagamento) ou aumenta (negativo, ajuste/juros). */
export async function POST(request: Request, { params }: Context): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Dívida não encontrada." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const parsed = parseDelta(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const updated = await applyDebtPayment(authResult.userId, id, parsed.value.deltaCents);
    if (!updated) return NextResponse.json({ error: "Dívida não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[financas/dividas] falha ao registrar pagamento");
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}
