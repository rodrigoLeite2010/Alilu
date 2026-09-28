import type { Metadata } from "next";
import { BudgetMethodCalculator } from "@/components/financas/BudgetMethodCalculator";
import { FinancePage } from "@/components/financas/FinancePage";

export const metadata: Metadata = { title: "Método 50/30/20", robots: { index: false, follow: false } };

export default async function Page() {
  return FinancePage({
    returnPath: "/financeiro/metodo-50-30-20",
    title: "Método 50/30/20",
    subtitle: "Uma referência simples para dividir sua renda.",
    children: <BudgetMethodCalculator />,
  });
}
