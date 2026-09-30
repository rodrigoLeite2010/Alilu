import type { Metadata } from "next";
import { FinancePage } from "@/components/financas/FinancePage";
import { PlanilhasDownloads } from "@/components/financas/PlanilhasDownloads";

export const metadata: Metadata = { title: "Planilhas financeiras", robots: { index: false, follow: false } };

export default async function Page() {
  return FinancePage({
    returnPath: "/financeiro/planilhas",
    title: "Planilhas financeiras",
    subtitle: "Modelos para baixar em CSV e XLSX.",
    children: <PlanilhasDownloads />,
  });
}
