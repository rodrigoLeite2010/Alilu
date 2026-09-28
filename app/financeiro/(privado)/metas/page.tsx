import type { Metadata } from "next";
import { GoalsManager } from "@/components/financas/GoalsManager";

export const metadata: Metadata = { title: "Metas financeiras", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-zinc-900">Metas financeiras</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">Defina quanto quer guardar e acompanhe o progresso.</p>
      <GoalsManager />
    </>
  );
}
