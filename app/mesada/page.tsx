import type { Metadata } from "next";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { MesadaHome } from "@/components/mesada/MesadaHome";
import { listChildrenOverview } from "@/lib/allowance/backend/allowance-service";
import { MesadaLoginGate } from "./_login-gate";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mesada | Alilu", robots: { index: false, follow: false } };

/** Mesada: painel familiar. Cada responsável vê só as próprias crianças. */
export default async function MesadaPage() {
  const userId = (await auth())?.user?.id;
  if (!userId) return <MesadaLoginGate returnPath="/mesada" />;
  const overview = await listChildrenOverview(userId);
  return (
    <Container className="max-w-4xl py-6 sm:py-10">
      <h1 className="text-2xl font-bold text-zinc-900">Mesada</h1>
      <p className="mt-1 mb-5 text-sm text-zinc-600">Mesada, gastos, cofrinho, metas e tarefas dos seus filhos num só lugar.</p>
      <MesadaHome overview={overview} />
    </Container>
  );
}
