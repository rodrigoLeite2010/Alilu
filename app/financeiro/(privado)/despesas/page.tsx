import type { Metadata } from "next";
import { EntriesManager } from "@/components/financas/EntriesManager";
import { FinancePage } from "@/components/financas/FinancePage";

export const metadata: Metadata = { title: "Despesas", robots: { index: false, follow: false } };

export default async function Page() {
  return FinancePage({
    returnPath: "/financeiro/despesas",
    title: "Despesas",
    subtitle: "Cadastre suas contas e gastos.",
    children: <EntriesManager kind="expense" />,
  });
}
