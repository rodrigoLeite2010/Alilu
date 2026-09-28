import type { Metadata } from "next";
import { FinancePage } from "@/components/financas/FinancePage";
import { GoalsManager } from "@/components/financas/GoalsManager";

export const metadata: Metadata = { title: "Metas financeiras", robots: { index: false, follow: false } };

export default async function Page() {
  return FinancePage({
    returnPath: "/financeiro/metas",
    title: "Metas financeiras",
    subtitle: "Defina quanto quer guardar e acompanhe o progresso.",
    children: <GoalsManager />,
  });
}
