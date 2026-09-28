import type { Metadata } from "next";
import { BudgetMethodCalculator } from "@/components/financas/BudgetMethodCalculator";

export const metadata: Metadata = { title: "Método 50/30/20", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-zinc-900">Método 50/30/20</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">Uma referência simples para dividir sua renda.</p>
      <BudgetMethodCalculator />
    </>
  );
}
