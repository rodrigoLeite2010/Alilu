import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/admin/admin-access";
import { MetaAppReviewPanel } from "@/components/admin/MetaAppReviewPanel";
import { parseReviewLang } from "@/lib/instagram/meta-app-review/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meta App Review — Instagram", robots: { index: false, follow: false } };

interface PageProps {
  searchParams: Promise<{ lang?: string }>;
}

/** Admin › Meta App Review — fluxo REAL para a gravação exigida pela Meta (só administradores). */
export default async function MetaAppReviewPage({ searchParams }: PageProps) {
  const admin = await getAdminSession();
  if (!admin) notFound();
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <MetaAppReviewPanel userId={admin.userId} initialLang={parseReviewLang(params.lang)} />
    </div>
  );
}
