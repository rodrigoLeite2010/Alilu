"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { EntryDialog } from "./EntryDialog";

const TABS = [
  { href: "/financeiro/meu-orcamento", label: "Meu orçamento" },
  { href: "/financeiro/calendario", label: "Calendário" },
  { href: "/financeiro/receitas", label: "Receitas" },
  { href: "/financeiro/despesas", label: "Despesas" },
  { href: "/financeiro/metas", label: "Metas" },
  { href: "/financeiro/assinaturas", label: "Assinaturas" },
  { href: "/financeiro/planejamento-anual", label: "Planejamento anual" },
  { href: "/financeiro/metodo-envelopes", label: "Envelopes" },
  { href: "/financeiro/dividas", label: "Dívidas" },
  { href: "/financeiro/reserva-de-emergencia", label: "Reserva" },
  { href: "/financeiro/metodo-50-30-20", label: "50/30/20" },
];

/** Moldura da área privada: abas + botão fixo "+ Adicionar gasto" (mobile first). */
export function FinanceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [quickOpen, setQuickOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-28 pt-6 sm:px-6">
      <div className="mb-4">
        <Link href="/financeiro/educacao-financeira" className="text-xs font-medium text-teal-800 hover:underline">
          ← Educação Financeira
        </Link>
      </div>
      <nav aria-label="Seções" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium ring-1 ring-inset ${
                active ? "bg-teal-700 text-white ring-teal-700" : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}

      <button
        type="button"
        onClick={() => setQuickOpen(true)}
        className="fixed bottom-5 right-5 z-40 min-h-12 rounded-full bg-teal-700 px-5 text-sm font-semibold text-white shadow-lg hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 print:hidden"
      >
        + Adicionar gasto
      </button>
      {quickOpen ? <EntryDialog open mode="quick-expense" onClose={() => setQuickOpen(false)} /> : null}
    </div>
  );
}
