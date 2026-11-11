import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { FacebookPagesFlowError, verifyFacebookPage } from "@/lib/facebook/backend/facebook-pages-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** "Verificar status" da Página: confere o token na Meta. */
export async function POST(_request: Request, { params }: RouteParams) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json(await verifyFacebookPage(id, userId));
  } catch (error) {
    if (error instanceof FacebookPagesFlowError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Não foi possível verificar a Página agora." }, { status: 502 });
  }
}
