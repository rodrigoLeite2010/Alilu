import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { getAdminSession } from "@/lib/admin/admin-access";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · Acessos", robots: { index: false, follow: false } };

/** Admin > Acessos (PostHog). Só ADMIN_EMAILS (qualquer outro usuário recebe 404). */
export default async function AdminAccessPage() {
  if (!(await getAdminSession())) notFound();
  return (
    <Container className="max-w-5xl py-8 md:py-10">
      <p className="text-sm text-zinc-500">
        <Link href="/admin" className="hover:underline">
          Admin
        </Link>{" "}
        › Acessos
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Acessos</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500">Quem está no site agora, visitantes e páginas mais vistas de hoje.</p>
      <AnalyticsDashboard />
    </Container>
  );
}
