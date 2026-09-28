import type { Metadata } from "next";
import { FinancePage } from "@/components/financas/FinancePage";
import { ReserveCalculator } from "@/components/financas/ReserveCalculator";

export const metadata: Metadata = { title: "Reserva de emergência", robots: { index: false, follow: false } };

export default async function Page() {
  return FinancePage({
    returnPath: "/financeiro/reserva-de-emergencia",
    title: "Reserva de emergência",
    subtitle: "Quanto guardar para ficar tranquilo em caso de imprevisto.",
    children: <ReserveCalculator />,
  });
}
