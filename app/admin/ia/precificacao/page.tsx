import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { getAdminSession } from "@/lib/admin/admin-access";
import { getPricingAdminView } from "@/lib/ai-video/backend/admin-service";
import { AiPricingAdmin } from "@/components/ai-video/admin/AiPricingAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · IA · Precificação", robots: { index: false, follow: false } };

/** Admin > IA > Precificação — só ADMIN_EMAILS (qualquer outro usuário recebe 404). */
export default async function AdminAiPricingPage() {
  if (!(await getAdminSession())) notFound();
  const view = await getPricingAdminView();
  return (
    <Container className="max-w-6xl py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">IA · Precificação</h1>
        <Link href="/admin/ia/custos" className="text-sm font-medium text-teal-800 hover:underline">
          Ver custos e margem →
        </Link>
      </div>
      <div className="mt-6">
        <AiPricingAdmin config={view.config} models={view.models.map((item) => item.row)} packages={view.packages.map((item) => item.pkg)} provider={view.provider} />
      </div>
    </Container>
  );
}
