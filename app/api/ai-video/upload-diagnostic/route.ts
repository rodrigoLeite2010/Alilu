import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * POST { stage, message, fileType, fileSize, fileExt, userAgent } — registra
 * (só no log da Vercel, scope "ai-video-upload") por que o envio da imagem
 * falhou no navegador da pessoa. Sem conteúdo da imagem nem nome do arquivo.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : null);
  console.warn(
    JSON.stringify({
      scope: "ai-video-upload",
      event: "client_failure",
      userId: session.user.id,
      stage: text(body?.stage, 40),
      message: text(body?.message, 300),
      fileType: text(body?.fileType, 60),
      fileExt: text(body?.fileExt, 10),
      fileSize: typeof body?.fileSize === "number" ? body.fileSize : null,
      userAgent: text(request.headers.get("user-agent"), 200),
    }),
  );
  return NextResponse.json({ ok: true });
}
