import { NextResponse } from "next/server";
import { isValidISODate } from "@/lib/financas/dates";
import { occurrenceDates } from "@/lib/financas/recurrence";
import { getEntry, setOccurrencePaid } from "@/lib/financas/backend/repository";
import { isUuid, requireUserId } from "@/lib/financas/backend/session";

type Context = { params: Promise<{ id: string }> };

/** POST { date, paid } — marca a ocorrência de `date` como paga/recebida (ou desfaz). */
export async function POST(request: Request, { params }: Context): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const raw = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (!isValidISODate(raw.date) || typeof raw.paid !== "boolean") {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  try {
    const entry = await getEntry(authResult.userId, id);
    if (!entry) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
    if (occurrenceDates(entry, raw.date, raw.date).length === 0) {
      return NextResponse.json({ error: "Essa data não pertence ao lançamento." }, { status: 400 });
    }
    await setOccurrencePaid(authResult.userId, entry, raw.date, raw.paid);
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[financas/pay] falha ao atualizar pagamento");
    return NextResponse.json({ error: "Não foi possível atualizar." }, { status: 500 });
  }
}
