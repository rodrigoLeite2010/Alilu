import type { Metadata } from "next";
import { FinancePage } from "@/components/financas/FinancePage";
import { SubscriptionsManager } from "@/components/financas/SubscriptionsManager";

export const metadata: Metadata = { title: "Assinaturas mensais", robots: { index: false, follow: false } };

export default async function Page() {
  return FinancePage({
    returnPath: "/financeiro/assinaturas",
    title: "Assinaturas mensais",
    subtitle: "Quanto você paga por mês e por ano em assinaturas.",
    children: <SubscriptionsManager />,
  });
}
