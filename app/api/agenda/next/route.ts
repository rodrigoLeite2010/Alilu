import { NextResponse } from "next/server";
import { getUserPreferences, nextAgendaItem } from "@/lib/agenda/backend/agenda-service";
import { sessionUserId } from "@/lib/agenda/backend/route-helpers";

export const dynamic = "force-dynamic";

/** GET: próximo compromisso (card da home). Deslogado → { loggedIn: false }. */
export async function GET(): Promise<NextResponse> {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ loggedIn: false });
  try {
    const [next, prefs] = await Promise.all([nextAgendaItem(userId), getUserPreferences(userId)]);
    return NextResponse.json({ loggedIn: true, next, timezone: prefs.timezone });
  } catch {
    return NextResponse.json({ loggedIn: true, next: null });
  }
}
