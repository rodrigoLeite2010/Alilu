import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/admin/admin-access";
import { dashboard, listBatches, listPartners, listSources } from "@/lib/imoveis/integracoes/repository";
import { IntegrationsPanel } from "@/components/imoveis/integracoes/IntegrationsPanel";
import "@/app/imoveis/imoveis.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin — Integração de imóveis",
  robots: { index: false, follow: false },
};

export default async function Page() {
  if (!(await getAdminSession())) notFound();
  const [d, partners, sources, batches] = await Promise.all([dashboard(), listPartners(), listSources(), listBatches(30)]);
  const initial = JSON.parse(JSON.stringify({ dashboard: d, partners, sources, batches }));
  return (
    <div className="property-portal mx-auto max-w-6xl px-4 py-10">
      <IntegrationsPanel initial={initial} />
    </div>
  );
}
