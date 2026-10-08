import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { ChildPanel } from "@/components/mesada/ChildPanel";
import { AllowanceError, getChildDashboard } from "@/lib/allowance/backend/allowance-service";
import { MesadaLoginGate } from "../_login-gate";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mesada | Alilu", robots: { index: false, follow: false } };

export default async function ChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = (await auth())?.user?.id;
  if (!userId) return <MesadaLoginGate returnPath={`/mesada/${id}`} />;
  let dashboard: Awaited<ReturnType<typeof getChildDashboard>>;
  try {
    dashboard = await getChildDashboard(userId, id);
  } catch (error) {
    if (error instanceof AllowanceError && error.httpStatus === 404) notFound();
    throw error;
  }
  return (
    <Container className="max-w-3xl py-6 sm:py-10">
      <ChildPanel dashboard={dashboard} />
    </Container>
  );
}
