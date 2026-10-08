import "server-only";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/admin-access";
import { AnalyticsNotConfiguredError } from "./posthog-query";

/** Casca comum das rotas /api/admin/analytics/*: exige ADMIN e nunca devolve 500 com detalhes. */
export async function adminAnalyticsResponse(load: () => Promise<unknown>): Promise<NextResponse> {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  try {
    return NextResponse.json({ configured: true, data: await load() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AnalyticsNotConfiguredError) {
      return NextResponse.json({ configured: false, error: "Analytics não configurado." }, { status: 200 });
    }
    console.error(JSON.stringify({ scope: "analytics", event: "query.failed", message: (error as Error)?.message }));
    return NextResponse.json({ configured: true, error: "O PostHog não respondeu agora. Tente novamente em instantes." }, { status: 502 });
  }
}
