import type { Metadata } from "next";
import { FinanceCalendar } from "@/components/financas/Calendar";

export const metadata: Metadata = {
  title: "Calendário financeiro",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-zinc-900">Calendário financeiro</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">Veja o que entra e o que vence em cada dia do mês.</p>
      <FinanceCalendar />
    </>
  );
}
