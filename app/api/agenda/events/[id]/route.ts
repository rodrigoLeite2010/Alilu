import { NextResponse } from "next/server";
import { deleteAgendaEvent, editAgendaEvent, getAgendaEvent, serializeEvent } from "@/lib/agenda/backend/agenda-service";
import { agendaError, readBody, sessionUserId, unauthorized } from "@/lib/agenda/backend/route-helpers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  try {
    return NextResponse.json({ event: serializeEvent(await getAgendaEvent(userId, id)) });
  } catch (error) {
    return agendaError(error, "get.crash");
  }
}

export async function PUT(request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  try {
    return NextResponse.json({ event: serializeEvent(await editAgendaEvent(userId, id, body)) });
  } catch (error) {
    return agendaError(error, "edit.crash");
  }
}

export async function DELETE(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const { id } = await params;
  try {
    await deleteAgendaEvent(userId, id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return agendaError(error, "delete.crash");
  }
}
