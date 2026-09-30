import { NextResponse } from "next/server";
import { deleteCategoryLimit, setCategoryLimit } from "@/lib/financas/backend/repository";
import { requireUserId } from "@/lib/financas/backend/session";
import { isValidExpenseCategory, parseCategoryLimitInput } from "@/lib/financas/validation";

type Context = { params: Promise<{ category: string }> };

/** PUT/DELETE por categoria (não por id): 1 limite por categoria por usuário, "category" já é a chave natural. */
export async function PUT(request: Request, { params }: Context): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;

  const { category } = await params;
  if (!isValidExpenseCategory(category)) {
    return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }
  const parsed = parseCategoryLimitInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    await setCategoryLimit(authResult.userId, category, parsed.value.limitCents);
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[financas/limites] falha ao salvar");
    return NextResponse.json({ error: "Não foi possível salvar o limite." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Context): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;

  const { category } = await params;
  if (!isValidExpenseCategory(category)) {
    return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
  }

  try {
    await deleteCategoryLimit(authResult.userId, category);
    return NextResponse.json({ ok: true });
  } catch {
    console.error("[financas/limites] falha ao excluir");
    return NextResponse.json({ error: "Não foi possível excluir o limite." }, { status: 500 });
  }
}
