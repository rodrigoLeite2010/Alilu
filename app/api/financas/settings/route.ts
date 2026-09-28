import { NextResponse } from "next/server";
import { setOpeningBalance, setSavingsGoal } from "@/lib/financas/backend/repository";
import { requireUserId } from "@/lib/financas/backend/session";
import { parseSettingsInput } from "@/lib/financas/validation";

/** PUT { savingsGoalCents? , month? + openingBalanceCents? } */
export async function PUT(request: Request): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const parsed = parseSettingsInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const { savingsGoalCents, month, openingBalanceCents } = parsed.value;
    if (savingsGoalCents !== undefined) await setSavingsGoal(authResult.userId, savingsGoalCents);
    if (openingBalanceCents !== undefined && month) {
      await setOpeningBalance(authResult.userId, month, openingBalanceCents);
    }
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[financas/settings] falha ao salvar");
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}
