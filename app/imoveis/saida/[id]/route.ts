import { createHmac } from "node:crypto";
import { outboundUrl } from "@/lib/imoveis/integracoes/repository";
import { UUID } from "@/lib/imoveis/model";

// "Ver anúncio original": redireciona para a URL validada do parceiro e conta
// um clique por visitante/dia (sem guardar IP). Bloqueado no robots.txt.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const back = new URL(`/imoveis`, request.url);
  if (!UUID.test(id)) return Response.redirect(back, 302);
  const secret = process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY ?? "";
  const key = createHmac("sha256", secret || "alilu")
    .update(`${new Date().toISOString().slice(0, 10)}:${request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local"}`)
    .digest("hex");
  const url = await outboundUrl(id, key).catch(() => null);
  if (!url) return Response.redirect(back, 302);
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "strict-origin-when-cross-origin" },
  });
}
