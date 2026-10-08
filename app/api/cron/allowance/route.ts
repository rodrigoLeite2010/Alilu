import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runAllowanceSchedule } from "@/lib/allowance/backend/schedule-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const provided = Buffer.from(header.slice(7).trim());
  if (provided.length < 16) return false;
  return [process.env.ALLOWANCE_CRON_SECRET, process.env.CRON_SECRET, process.env.AGENDA_CRON_SECRET, process.env.INSTAGRAM_SCHEDULER_SECRET]
    .filter((value): value is string => typeof value === "string" && value.length >= 16)
    .some((secret) => {
      const expected = Buffer.from(secret);
      return expected.length === provided.length && timingSafeEqual(expected, provided);
    });
}

/** Cron externo 1x/dia (ex.: 06:00): GET|POST com Authorization: Bearer <segredo>. Lança a mesada do dia, sem duplicar. */
async function handle(request: Request): Promise<NextResponse> {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    return NextResponse.json(await runAllowanceSchedule());
  } catch (error) {
    console.error(JSON.stringify({ scope: "allowance", event: "cron_failed", message: (error as Error)?.message?.slice(0, 200) }));
    return NextResponse.json({ error: "Falha no cron." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
