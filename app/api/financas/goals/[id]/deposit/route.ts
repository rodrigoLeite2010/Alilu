import { NextResponse } from "next/server";
import { addToGoal } from "@/lib/financas/backend/repository";
import { isUuid, requireUserId } from "@/lib/financas/backend/session";
import { parseDelta } from "@/lib/financas/validation";

type Context = { params: Promise<{ id: string }> };

/** POST { deltaCents } — soma (positivo) ou retira (negativo) do valor já guardado. */
export async function POST(request: Request, { params }: Context): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Meta não encontrada." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const parsed = parseDelta(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const updated = await addToGoal(authResult.userId, id, parsed.value.deltaCents);
    if (!updated) return NextResponse.json({ error: "Meta não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[financas/goals] falha ao registrar valor");
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}
