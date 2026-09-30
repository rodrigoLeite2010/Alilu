import type { Metadata } from "next";
import { FinancePage } from "@/components/financas/FinancePage";
import { AnnualPlanView } from "@/components/financas/AnnualPlanView";

export const metadata: Metadata = { title: "Planejamento anual", robots: { index: false, follow: false } };

export default async function Page() {
  return FinancePage({
    returnPath: "/financeiro/planejamento-anual",
    title: "Planejamento anual",
    subtitle: "Receitas, despesas e saldo mês a mês.",
    children: <AnnualPlanView />,
  });
}
