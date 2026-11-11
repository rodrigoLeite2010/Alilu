import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listDestinationAttempts } from "@/lib/facebook/backend/social-destination-repository";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Histórico de tentativas de um destino (restrito ao dono; sem dados sensíveis). */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ attempts: await listDestinationAttempts(id, userId) });
}
