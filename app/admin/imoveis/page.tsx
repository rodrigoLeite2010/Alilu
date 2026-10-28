import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/admin/admin-access";
import { adminOverview } from "@/lib/imoveis/repository";
import { AdminPanel } from "@/components/imoveis/AdminPanel";
import "@/app/imoveis/imoveis.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin — Imóveis",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!(await getAdminSession())) notFound();
  const raw = Number((await searchParams).page);
  const page = Number.isFinite(raw)
    ? Math.min(1000, Math.max(1, Math.floor(raw) || 1))
    : 1;
  const overview = await adminOverview(page);
  return (
    <div className="property-portal mx-auto max-w-6xl px-4 py-10">
      <AdminPanel
        {...(overview as unknown as Parameters<typeof AdminPanel>[0])}
        page={page}
      />
    </div>
  );
}
