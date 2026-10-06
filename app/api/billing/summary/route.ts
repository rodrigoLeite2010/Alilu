import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBillingSummary } from "@/lib/billing/backend/automation-access-service";
import { serializeBillingSummary } from "@/lib/billing/backend/billing-dto";
import { listPlans } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

/**
 * GET: o que as telas precisam do plano do usuário numa só chamada — plano
 * em vigor, o que ele libera (Piloto, IA, importador), uso da franquia de
 * IA do ciclo e avisos prontos ("restam 18 publicações"). Somente leitura:
 * nunca reserva uso. Sem sessão devolve só o catálogo de planos (a tela de
 * planos aparece para quem ainda não entrou, com o convite para entrar).
 */
export async function GET(): Promise<NextResponse> {
  const plans = listPlans().map((plan) => ({
    code: plan.code,
    name: plan.name,
    priceCents: plan.priceCents,
    includesAi: plan.includesAi,
    aiPostsPerCycle: plan.aiPostsPerCycle,
    aiDailyReference: plan.aiDailyReference,
    includesImporter: plan.includesImporter,
    features: plan.features,
    upcoming: plan.upcoming,
  }));

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ authenticated: false, plans, summary: null }, { headers: { "Cache-Control": "no-store" } });
  }

  const summary = await getBillingSummary(userId);
  return NextResponse.json(
    { authenticated: true, plans, summary: serializeBillingSummary(summary) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
