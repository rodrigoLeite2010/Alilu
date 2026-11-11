import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { disconnectFacebookPage } from "@/lib/facebook/backend/facebook-page-repository";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Desconecta a Página: o token é apagado (as publicações já feitas continuam no Facebook). */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const ok = await disconnectFacebookPage(id, userId);
  if (!ok) return NextResponse.json({ error: "Página não encontrada." }, { status: 404 });
  return NextResponse.json({ status: "revoked" });
}
