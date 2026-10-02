import { NextResponse } from "next/server";
import { getUserPreferences, updateUserPreferences } from "@/lib/agenda/backend/agenda-service";
import { agendaError, readBody, sessionUserId, unauthorized } from "@/lib/agenda/backend/route-helpers";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  return NextResponse.json({ preferences: await getUserPreferences(userId) });
}

/** PUT { timezone?, defaultReminderMinutes?, emailRemindersEnabled? } */
export async function PUT(request: Request): Promise<NextResponse> {
  const userId = await sessionUserId();
  if (!userId) return unauthorized();
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  try {
    return NextResponse.json({ preferences: await updateUserPreferences(userId, body) });
  } catch (error) {
    return agendaError(error, "preferences.crash");
  }
}
