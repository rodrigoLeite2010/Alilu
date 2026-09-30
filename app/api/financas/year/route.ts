import { NextResponse } from "next/server";
import { isValidYear, todayISO } from "@/lib/financas/dates";
import { expandOccurrences } from "@/lib/financas/recurrence";
import { listEntriesForRange, listPaymentsForRange } from "@/lib/financas/backend/repository";
import { requireUserId } from "@/lib/financas/backend/session";

/** GET ?year=YYYY — ocorrências do ano inteiro, para o Planejamento anual. */
export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;

  const requested = new URL(request.url).searchParams.get("year");
  const year = requested ?? todayISO().slice(0, 4);
  if (!isValidYear(year)) {
    return NextResponse.json({ error: "Ano inválido." }, { status: 400 });
  }

  try {
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;
    const [entries, payments] = await Promise.all([
      listEntriesForRange(authResult.userId, from, to),
      listPaymentsForRange(authResult.userId, from, to),
    ]);
    return NextResponse.json({
      year,
      today: todayISO(),
      occurrences: expandOccurrences(entries, payments, from, to),
    });
  } catch {
    console.error("[financas/year] falha ao carregar o ano");
    return NextResponse.json({ error: "Não foi possível carregar seus dados do ano." }, { status: 500 });
  }
}
