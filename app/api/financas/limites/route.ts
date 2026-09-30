import { NextResponse } from "next/server";
import { listCategoryLimits } from "@/lib/financas/backend/repository";
import { requireUserId } from "@/lib/financas/backend/session";

export async function GET(): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;
  try {
    return NextResponse.json({ limits: await listCategoryLimits(authResult.userId) });
  } catch {
    console.error("[financas/limites] falha ao listar");
    return NextResponse.json({ error: "Não foi possível carregar os limites." }, { status: 500 });
  }
}
