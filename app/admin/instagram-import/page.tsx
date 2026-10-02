import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { getAdminSession } from "@/lib/admin/admin-access";
import { getImportSettings, importStatsSince } from "@/lib/instagram-import/backend/import-repository";
import { ImportSettingsForm } from "@/components/instagram-import/ImportSettingsForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · Importar do Instagram", robots: { index: false, follow: false } };

/** Admin > Importar do Instagram: limites, custo do provedor (só registro) e uso. */
export default async function AdminInstagramImportPage() {
  if (!(await getAdminSession())) notFound();
  const now = new Date();
  const [settings, today, month] = await Promise.all([
    getImportSettings(),
    importStatsSince(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))),
    importStatsSince(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))),
  ]);
  const rows: [string, typeof today][] = [
    ["Hoje (UTC)", today],
    ["Este mês (UTC)", month],
  ];
  return (
    <Container className="max-w-3xl py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">Importar do Instagram</h1>
      <p className="mt-1 text-sm text-zinc-600">Provedor: Apify (Instagram Downloader API). Importar não consome créditos do usuário — o custo é só registrado.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {rows.map(([title, data]) => (
          <section key={title} className="rounded-lg border border-zinc-200 p-4 text-sm">
            <h2 className="font-semibold text-zinc-900">{title}</h2>
            <p className="mt-2">Consultas: {data.total}</p>
            <p>Importadas: {data.completed}</p>
            <p>Falhas / indisponíveis: {data.failed}</p>
            <p>Custo estimado do provedor: US$ {data.costUsd.toFixed(4)}</p>
            <p>Volume importado: {(data.bytes / 1024 / 1024).toFixed(1)} MB</p>
          </section>
        ))}
      </div>
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-zinc-900">Limites</h2>
        <ImportSettingsForm initial={settings} />
      </section>
    </Container>
  );
}
