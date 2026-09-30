import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canUseAutomation } from "@/lib/billing/backend/automation-access-service";
import { serializeAccessResult } from "@/lib/billing/backend/billing-dto";

export const dynamic = "force-dynamic";

/**
 * GET: status atual do acesso ao Piloto Automático (trial/limite
 * diário/assinatura) — usado pelos banners da tela. Só leitura, nunca
 * reserva um uso (isso só acontece dentro do cron, na hora de gerar de
 * verdade — ver content-automation-cron.ts).
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const result = await canUseAutomation(userId);
  return NextResponse.json(serializeAccessResult(result));
}
