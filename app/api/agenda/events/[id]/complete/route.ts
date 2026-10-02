import { NextResponse } from "next/server";
import { changeAgendaStatus, serializeEvent } from "@/lib/agenda/backend/agenda-service";
import { agendaError, sessionUserId, unauthorized } from "@/lib/agenda/backend/route-helpers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST: marca o compromisso como COMPLETED (lembretes pendentes são ajustados). */
export async function POST(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  try {
    return NextResponse.json({ event: serializeEvent(await changeAgendaStatus(userId, id, "COMPLETED")) });
  } catch (error) {
    return agendaError(error, "status.crash");
  }
}
