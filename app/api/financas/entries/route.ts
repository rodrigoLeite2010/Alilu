import { NextResponse } from "next/server";
import { createEntry, listAllEntries } from "@/lib/financas/backend/repository";
import { requireUserId } from "@/lib/financas/backend/session";
import { parseEntryInput } from "@/lib/financas/validation";

/** GET ?kind=income|expense — lista de lançamentos; POST — cria um lançamento. */
export async function GET(request: Request): Promise<NextResponse> {
  const authResult = await requireUserId();
  if ("response" in authResult) return authResult.response;

  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "income" && kind !== "expense") {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }
  try {
    return NextResponse.json({ entries: await listAllEntries(authResult.userId, kind) });
  } catch {
    console.error("[financas/entries] falha ao listar");
    return NextResponse.json({ error: "Não foi possível carregar os lançamentos." }, { status: 500 });
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
  const parsed = parseEntryInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const id = await createEntry(authResult.userId, parsed.value);
    return NextResponse.json({ id }, { status: 201 });
  } catch {
    console.error("[financas/entries] falha ao criar");
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}
