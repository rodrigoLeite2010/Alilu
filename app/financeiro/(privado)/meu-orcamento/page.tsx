import type { Metadata } from "next";
import { Dashboard } from "@/components/financas/Dashboard";
import { FinancePage } from "@/components/financas/FinancePage";

export const metadata: Metadata = { title: "Meu orçamento mensal", robots: { index: false, follow: false } };

export default async function Page() {
  return FinancePage({
    returnPath: "/financeiro/meu-orcamento",
    title: "Meu orçamento mensal",
    subtitle: "Para onde está indo seu dinheiro e quanto ainda você pode gastar.",
    children: <Dashboard />,
  });
}
