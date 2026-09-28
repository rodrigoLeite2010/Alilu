import { NextResponse } from "next/server";
import { isValidMonth, monthRange, todayISO } from "@/lib/financas/dates";
import { expandOccurrences } from "@/lib/financas/recurrence";
import {
  getOpeningBalance,
  getSettings,
  listEntriesForRange,
  listPaymentsForRange,
} from "@/lib/financas/backend/repository";
import { requireUserId } from "@/lib/financas/backend/session";

/** GET ?month=YYYY-MM — ocorrências do mês + configurações do usuário. */
export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;

  const requested = new URL(request.url).searchParams.get("month");
  const month = requested ?? todayISO().slice(0, 7);
  if (!isValidMonth(month)) {
    return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
  }

  try {
    const { from, to } = monthRange(month);
    const [entries, payments, settings, openingBalanceCents] = await Promise.all([
      listEntriesForRange(authResult.userId, from, to),
      listPaymentsForRange(authResult.userId, from, to),
      getSettings(authResult.userId),
      getOpeningBalance(authResult.userId, month),
    ]);
    return NextResponse.json({
      month,
      today: todayISO(),
      occurrences: expandOccurrences(entries, payments, from, to),
      savingsGoalCents: settings.savingsGoalCents,
      openingBalanceCents,
    });
  } catch {
    console.error("[financas/month] falha ao carregar o mês");
    return NextResponse.json({ error: "Não foi possível carregar seus dados." }, { status: 500 });
  }
}
