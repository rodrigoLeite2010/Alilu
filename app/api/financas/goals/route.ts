import { NextResponse } from "next/server";
import { createGoal, listGoals } from "@/lib/financas/backend/repository";
import { requireUserId } from "@/lib/financas/backend/session";
import { parseGoalInput } from "@/lib/financas/validation";

export async function GET(): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;
  try {
    return NextResponse.json({ goals: await listGoals(authResult.userId) });
  } catch {
    console.error("[financas/goals] falha ao listar");
    return NextResponse.json({ error: "Não foi possível carregar as metas." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const parsed = parseGoalInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const id = await createGoal(authResult.userId, parsed.value);
    return NextResponse.json({ id }, { status: 201 });
  } catch {
    console.error("[financas/goals] falha ao criar");
    return NextResponse.json({ error: "Não foi possível salvar a meta." }, { status: 500 });
  }
}
