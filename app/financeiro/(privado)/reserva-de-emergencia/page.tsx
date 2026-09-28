import type { Metadata } from "next";
import { ReserveCalculator } from "@/components/financas/ReserveCalculator";

export const metadata: Metadata = { title: "Reserva de emergência", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-zinc-900">Reserva de emergência</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">Quanto guardar para ficar tranquilo em caso de imprevisto.</p>
      <ReserveCalculator />
    </>
  );
}
