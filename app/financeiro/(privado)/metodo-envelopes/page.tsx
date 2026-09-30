import type { Metadata } from "next";
import { FinancePage } from "@/components/financas/FinancePage";
import { EnvelopesManager } from "@/components/financas/EnvelopesManager";

export const metadata: Metadata = { title: "Método dos envelopes", robots: { index: false, follow: false } };

export default async function Page() {
  return FinancePage({
    returnPath: "/financeiro/metodo-envelopes",
    title: "Método dos envelopes",
    subtitle: "Limites por categoria com barra de progresso.",
    children: <EnvelopesManager />,
  });
}
