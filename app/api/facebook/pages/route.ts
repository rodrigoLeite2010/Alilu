import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listFacebookPagesForUser } from "@/lib/facebook/backend/facebook-page-repository";
import { FACEBOOK_PAGES_PERMISSIONS, facebookPagesConfigured } from "@/lib/facebook/backend/facebook-pages-oauth";

export const dynamic = "force-dynamic";

/** Páginas do Facebook do usuário (nunca devolve token). */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const pages = await listFacebookPagesForUser(userId);
  return NextResponse.json({
    configured: facebookPagesConfigured(),
    requiredPermissions: FACEBOOK_PAGES_PERMISSIONS,
    pages: pages.map((page) => ({
      id: page.id,
      pageId: page.pageId,
      pageName: page.pageName,
      status: page.hasToken ? page.status : "revoked",
      linkedIgUsername: page.linkedIgUsername,
      instagramAccountId: page.instagramAccountId,
      scopes: page.scopes,
      lastErrorSanitized: page.lastErrorSanitized,
      lastCheckedAt: page.lastCheckedAt,
    })),
  });
}
