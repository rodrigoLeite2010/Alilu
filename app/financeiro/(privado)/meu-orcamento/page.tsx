import type { Metadata } from "next";
import { Dashboard } from "@/components/financas/Dashboard";

export const metadata: Metadata = {
  title: "Meu orçamento mensal",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-zinc-900">Meu orçamento mensal</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">Para onde está indo seu dinheiro e quanto ainda você pode gastar.</p>
      <Dashboard />
    </>
  );
}
