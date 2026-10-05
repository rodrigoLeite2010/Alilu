import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

const TOOLS = new Set(["ai-video-image", "ai-video-logo", "split-screen", "reels", "instagram-import", "media-picker"]);
const STAGES = new Set([
  "picker_open",
  "file_selected",
  "no_file",
  "validation_error",
  "prepare_done",
  "upload_start",
  "upload_done",
  "upload_error",
  "metadata_loaded",
  "metadata_error",
  "page_reloaded_during_picker",
]);

const text = (value: unknown, max: number) => (typeof value === "string" && value ? value.slice(0, max) : null);

/**
 * POST — telemetria de upload do navegador (lib/client/upload-telemetry.ts).
 * Público (o Split-Screen funciona sem login), só aceita valores conhecidos e
 * campos curtos; nunca recebe conteúdo nem nome de arquivo.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const raw = await request.text().catch(() => "");
  if (raw.length > 4000) return NextResponse.json({ ok: false }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (typeof body.tool !== "string" || !TOOLS.has(body.tool) || typeof body.stage !== "string" || !STAGES.has(body.stage)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const session = await auth().catch(() => null);
  const fileSize = typeof body.fileSize === "number" && Number.isFinite(body.fileSize) ? Math.round(body.fileSize) : null;
  const event = {
    tool: body.tool,
    stage: body.stage,
    fileType: text(body.fileType, 80),
    fileExt: text(body.fileExt, 10),
    fileSize,
    message: text(body.message, 300),
    userAgent: text(request.headers.get("user-agent"), 300),
  };
  if (event.stage === "upload_error" || event.stage === "validation_error" || event.stage === "metadata_error" || event.stage === "page_reloaded_during_picker") {
    console.warn(JSON.stringify({ scope: "client-upload", ...event, userId: session?.user?.id ?? null }));
  }
  try {
    const db = getDb();
    await db`
      insert into client_upload_events (user_id, page_session, tool, stage, file_type, file_ext, file_size, message, user_agent)
      values (${session?.user?.id ?? null}, ${text(body.pageSession, 20)}, ${event.tool}, ${event.stage}, ${event.fileType}, ${event.fileExt},
        ${event.fileSize}, ${event.message}, ${event.userAgent})
    `;
  } catch {
    // diagnóstico é melhor esforço
  }
  return NextResponse.json({ ok: true });
}
