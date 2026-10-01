import { NextResponse } from "next/server";
import { getImportForUser } from "@/lib/instagram-import/backend/import-repository";
import { deleteInstagramImport } from "@/lib/instagram-import/backend/import-service";
import { serializeImport } from "@/lib/instagram-import/backend/import-dto";
import { requireUserId } from "@/lib/instagram-import/backend/route-helpers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET: uma importação do próprio usuário (usado pelo split-screen e pelo Reels para pré-carregar o arquivo). */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const record = await getImportForUser(id, userId);
  if (!record) return NextResponse.json({ error: "Importação não encontrada." }, { status: 404 });
  return NextResponse.json({ import: serializeImport(record) });
}

/** DELETE: apaga o registro e o arquivo guardado. */
export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const removed = await deleteInstagramImport(userId, id);
  if (!removed) return NextResponse.json({ error: "Importação não encontrada." }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
