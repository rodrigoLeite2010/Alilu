import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { getAdminSession } from "@/lib/admin/admin-access";
import { getCleanupSettings, listCleanupRuns } from "@/lib/storage-cleanup/backend/cleanup-service";
import { StorageCleanupAdmin } from "@/components/storage-cleanup/StorageCleanupAdmin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · Armazenamento", robots: { index: false, follow: false } };

/** Admin > Armazenamento: limpeza automática do Vercel Blob (simulação, prazos, histórico). */
export default async function AdminStoragePage() {
  if (!(await getAdminSession())) notFound();
  const [settings, runs] = await Promise.all([getCleanupSettings(), listCleanupRuns(10)]);
  return (
    <Container className="max-w-4xl py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">Armazenamento (Vercel Blob)</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Limpeza automática de arquivos temporários, órfãos e vencidos. Comece em <strong>simulação</strong>: confira o relatório e só depois
        desligue a simulação para apagar de verdade.
      </p>
      <StorageCleanupAdmin settings={settings} runs={runs} />
    </Container>
  );
}
