import type { Metadata } from "next";
import { FinancePage } from "@/components/financas/FinancePage";
import { DebtsManager } from "@/components/financas/DebtsManager";

export const metadata: Metadata = { title: "Controle de dívidas", robots: { index: false, follow: false } };

export default async function Page() {
  return FinancePage({
    returnPath: "/financeiro/dividas",
    title: "Controle de dívidas",
    subtitle: "Saldo devedor, parcelas e previsão de término.",
    children: <DebtsManager />,
  });
}
