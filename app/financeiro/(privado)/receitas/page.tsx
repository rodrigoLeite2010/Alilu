import type { Metadata } from "next";
import { EntriesManager } from "@/components/financas/EntriesManager";

export const metadata: Metadata = {
  title: "Receitas",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-zinc-900">Receitas</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">Cadastre o que você recebe.</p>
      <EntriesManager kind="income" />
    </>
  );
}
