import type { Metadata } from "next";
import { FinanceCalendar } from "@/components/financas/Calendar";
import { FinancePage } from "@/components/financas/FinancePage";

export const metadata: Metadata = { title: "Calendário financeiro", robots: { index: false, follow: false } };

export default async function Page() {
  return FinancePage({
    returnPath: "/financeiro/calendario",
    title: "Calendário financeiro",
    subtitle: "Veja o que entra e o que vence em cada dia do mês.",
    children: <FinanceCalendar />,
  });
}
