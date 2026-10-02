import { NextResponse } from "next/server";
import { createAgendaEvent, listAgenda, serializeEvent } from "@/lib/agenda/backend/agenda-service";
import { agendaError, readBody, sessionUserId, unauthorized } from "@/lib/agenda/backend/route-helpers";

export const dynamic = "force-dynamic";

/** GET ?from=ISO&to=ISO&q=&category= — compromissos e ocorrências do período (só do usuário logado). */
export async function GET(request: Request): Promise<NextResponse> {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const params = new URL(request.url).searchParams;
  const from = new Date(params.get("from") ?? "");
  const to = new Date(params.get("to") ?? "");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  try {
    return NextResponse.json(await listAgenda(userId, from, to, { q: params.get("q"), category: params.get("category") }));
  } catch (error) {
    return agendaError(error, "list.crash");
  }
}

/** POST { title, date, time?, endTime?, description?, category?, location?, recurrence?, reminders? } */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  try {
    return NextResponse.json({ event: serializeEvent(await createAgendaEvent(userId, body)) }, { status: 201 });
  } catch (error) {
    return agendaError(error, "create.crash");
  }
}
