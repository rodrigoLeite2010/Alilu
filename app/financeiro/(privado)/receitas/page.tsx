import type { Metadata } from "next";
import { EntriesManager } from "@/components/financas/EntriesManager";
import { FinancePage } from "@/components/financas/FinancePage";

export const metadata: Metadata = { title: "Receitas", robots: { index: false, follow: false } };

export default async function Page() {
  return FinancePage({
    returnPath: "/financeiro/receitas",
    title: "Receitas",
    subtitle: "Cadastre o que você recebe.",
    children: <EntriesManager kind="income" />,
  });
}
