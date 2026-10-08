"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatCents } from "@/lib/allowance/money";
import type { ChildOverview } from "@/lib/allowance/types";
import { call, formatDayMonth } from "./api";
import { QuickForm } from "./QuickForm";

const AVATARS = ["🦄", "🐻", "🦊", "🐼", "🐸", "🦁", "🐯", "🐰", "🐶", "🐱", "🚀", "⚽"];

export function Avatar({ avatar, name, size = "h-14 w-14 text-3xl" }: { avatar: string | null; name: string; size?: string }) {
  const isUrl = avatar?.startsWith("https://");
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-100 ${size}`}>
      {isUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar opcional de URL externa
        <img src={avatar!} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{avatar || name.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  );
}

/** Painel familiar: um cartão grande por criança + resumo geral. */
export function MesadaHome({ overview }: { overview: ChildOverview[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  const totalBalance = overview.reduce((sum, o) => sum + o.balanceCents, 0);
  const totalSavings = overview.reduce((sum, o) => sum + o.savingsCents, 0);

  return (
    <div className="space-y-6">
      {overview.length > 1 ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Saldo da família</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900">{formatCents(totalBalance)}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Nos cofrinhos</p>
            <p className="mt-1 text-2xl font-bold text-zinc-900">{formatCents(totalSavings)}</p>
          </div>
        </div>
      ) : null}

      {overview.length === 0 ? (
        <section className="rounded-lg border border-dashed border-zinc-300 p-8 text-center">
          <p className="text-4xl" aria-hidden>
            🐷
          </p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-900">Cadastre a primeira criança</h2>
          <p className="mt-1 text-sm text-zinc-600">Defina a mesada, registre os gastos e acompanhe o cofrinho e as metas.</p>
        </section>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {overview.map((o) => (
            <li key={o.child.id}>
              <Link
                href={`/mesada/${o.child.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <div className="flex items-center gap-3">
                  <Avatar avatar={o.child.avatar} name={o.child.name} />
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-zinc-900">{o.child.name}</h2>
                    <p className="text-xs text-zinc-500">
                      {o.monthlyAmountCents !== null ? `Mesada ${formatCents(o.monthlyAmountCents)} · próxima ${formatDayMonth(o.nextPaymentDate)}` : "Mesada ainda não definida"}
                    </p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs text-zinc-500">Saldo disponível</dt>
                    <dd className={`text-xl font-bold ${o.balanceCents < 0 ? "text-red-700" : "text-zinc-900"}`}>{formatCents(o.balanceCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-zinc-500">Cofrinho</dt>
                    <dd className="text-xl font-bold text-amber-700">{formatCents(o.savingsCents)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-zinc-500">
                  Metas ativas: {o.activeGoals} · Recompensas no mês: {formatCents(o.rewardsThisMonthCents)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => setAdding(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" aria-hidden /> Adicionar criança
        </Button>
        <Link href="/mesada/categorias" className="inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold text-teal-800 hover:bg-teal-50 sm:w-auto">
          Gerenciar categorias
        </Link>
      </div>

      <QuickForm
        open={adding}
        title="Adicionar criança"
        submitLabel="Adicionar"
        onClose={() => setAdding(false)}
        fields={[
          { name: "name", label: "Nome", type: "text", required: true, maxLength: 60 },
          { name: "avatar", label: "Avatar", type: "select", defaultValue: AVATARS[0], options: AVATARS.map((a) => ({ value: a, label: a })) },
          { name: "birthDate", label: "Nascimento (opcional)", type: "date" },
        ]}
        onSubmit={async (values) => {
          const result = await call<{ id: string }>("POST", "/api/allowance/children", values);
          if (result.error) return result.error;
          router.push(`/mesada/${result.data!.id}`);
          return null;
        }}
      />
    </div>
  );
}
