import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { getAdminSession } from "@/lib/admin/admin-access";
import { getCarouselAdminMetrics } from "@/lib/carousel/backend/carousel-admin-metrics";
import { formatBrl } from "@/lib/ai-video/pricing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · Carrossel Inteligente", robots: { index: false, follow: false } };

const brlFromCents = (cents: number) => formatBrl(cents / 100);
const int = (value: number) => value.toLocaleString("pt-BR");
const cost = (value: number | null) => (value === null ? "—" : formatBrl(value));

function Stat({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "warn" }) {
  return (
    <div className={`rounded-lg border p-4 ${tone === "warn" ? "border-amber-300 bg-amber-50" : "border-zinc-200"}`}>
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      {note ? <p className="mt-1 text-xs text-zinc-500">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
          <tr>
            {head.map((label) => (
              <th key={label} className="px-3 py-2">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 tabular-nums">{children}</tbody>
      </table>
    </div>
  );
}

/** Admin › Carrossel Inteligente: assinantes, MRR, uso, custo de IA, receita e margem. */
export default async function AdminCarouselPage() {
  if (!(await getAdminSession())) notFound();
  const data = await getCarouselAdminMetrics();
  return (
    <Container className="max-w-6xl py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">Carrossel Inteligente</h1>
        <Link href="/admin/assinaturas/usuarios" className="text-sm font-medium text-teal-800 hover:underline">
          Usuários e planos →
        </Link>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Atualizado em {new Date(data.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Mês = mês UTC.
      </p>

      {data.alerts.length > 0 ? (
        <ul className="mt-4 space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {data.alerts.map((alert) => (
            <li key={alert}>⚠ {alert}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="MRR" value={brlFromCents(data.mrr.totalCents)} hint={`Líquido estimado ${formatBrl(data.mrr.netBrl)} · desconto de cliente Alilu: −${brlFromCents(data.mrr.discountGivenCents)}/mês`} />
        <Stat label="Assinantes ativos" value={int(data.subscribers.active)} hint={`${int(data.subscribers.complimentary)} cortesia · ${int(data.subscribers.pendingPayment)} aguardando pagamento`} />
        <Stat label="Em atraso" value={int(data.subscribers.pastDue)} tone={data.subscribers.pastDue > 0 ? "warn" : "default"} hint={`${int(data.subscribers.canceledWithAccess)} cancelado(s) com acesso`} />
        <Stat label="Movimento 30 dias" value={`+${int(data.movement30d.newPaid)} / −${int(data.movement30d.canceled)}`} hint="novos pagantes / cancelamentos" />
      </div>

      <Section title="Planos" note="Margem estimada = (MRR líquido − custo de IA dos assinantes do plano no mês) ÷ MRR líquido.">
        <Table head={["Plano", "Assinantes", "MRR", "Com desconto", "Cortesia", "Atraso", "Concluídos (mês)", "Custo IA (mês)", "Margem est."]}>
          {data.plans.map((plan) => (
            <tr key={plan.code}>
              <td className="px-3 py-2 font-medium text-zinc-900">
                {plan.name} <span className="font-normal text-zinc-500">{brlFromCents(plan.listPriceCents)} · {plan.quotaPerCycle}/mês</span>
              </td>
              <td className="px-3 py-2">{int(plan.subscribers)}</td>
              <td className="px-3 py-2">{brlFromCents(plan.mrrCents)}</td>
              <td className="px-3 py-2">{int(plan.discounted)}</td>
              <td className="px-3 py-2">{int(plan.complimentary)}</td>
              <td className="px-3 py-2">{int(plan.pastDue)}</td>
              <td className="px-3 py-2">{int(plan.completedMonth)}</td>
              <td className="px-3 py-2">{cost(plan.costBrl)}</td>
              <td className="px-3 py-2">{plan.marginPct === null ? "—" : `${plan.marginPct.toFixed(0)}%`}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Uso e teste grátis">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Criados no mês" value={int(data.projects.createdMonth)} />
          <Stat label="Concluídos no mês" value={int(data.projects.completedMonth)} />
          <Stat label="Falhas no mês" value={int(data.projects.failedMonth)} tone={data.projects.failedMonth > 0 ? "warn" : "default"} />
          <Stat label="Teste grátis" value={`${int(data.trial.claimed30d)} / 30d`} hint={`${int(data.trial.claimedTotal)} no total · ${int(data.trial.convertedToPaid)} viraram assinantes`} />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Por status: {Object.keys(data.projects.byStatus).length === 0 ? "nenhum carrossel ainda" : Object.entries(data.projects.byStatus).map(([s, n]) => `${s}: ${n}`).join(" · ")}
        </p>
      </Section>

      <Section title="Custo de IA (mês)" note="Tokens e buscas na web registrados por chamada. O usuário nunca é cobrado por token — é só análise interna.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Chamadas" value={int(data.ai.calls)} />
          <Stat label="Buscas na web" value={int(data.ai.webSearches)} />
          <Stat label="Custo estimado" value={cost(data.ai.costBrl)} hint={data.ai.pricingConfigured ? undefined : "Preço do modelo/câmbio não configurado"} />
          <Stat label="Custo por carrossel concluído" value={cost(data.ai.costPerCompletedBrl)} />
        </div>
        {data.ai.byFeature.length > 0 ? (
          <div className="mt-3">
            <Table head={["Função", "Chamadas", "Tokens entrada", "Tokens saída", "Buscas", "Custo"]}>
              {data.ai.byFeature.map((item) => (
                <tr key={item.feature}>
                  <td className="px-3 py-2 font-medium text-zinc-900">{item.feature.replace("carousel_", "")}</td>
                  <td className="px-3 py-2">{int(item.calls)}</td>
                  <td className="px-3 py-2">{int(item.tokensInput)}</td>
                  <td className="px-3 py-2">{int(item.tokensOutput)}</td>
                  <td className="px-3 py-2">{int(item.webSearches)}</td>
                  <td className="px-3 py-2">{cost(item.costBrl)}</td>
                </tr>
              ))}
            </Table>
          </div>
        ) : null}
      </Section>

      <Section title="Maiores consumidores (mês)" note="“Prejuízo” = custo de IA acima da mensalidade líquida (usuário em teste grátis sempre aparece, pois não paga).">
        {data.heavyUsers.length === 0 ? (
          <p className="text-sm text-zinc-600">Nenhum uso de IA do carrossel neste mês.</p>
        ) : (
          <Table head={["Usuário", "Plano", "Situação", "Chamadas", "Buscas", "Custo", "Mensalidade líq.", ""]}>
            {data.heavyUsers.map((user) => (
              <tr key={user.email}>
                <td className="px-3 py-2 font-medium text-zinc-900">{user.email}</td>
                <td className="px-3 py-2">{user.planCode ?? "—"}</td>
                <td className="px-3 py-2">{user.status ?? "teste/sem plano"}</td>
                <td className="px-3 py-2">{int(user.calls)}</td>
                <td className="px-3 py-2">{int(user.webSearches)}</td>
                <td className="px-3 py-2">{cost(user.costBrl)}</td>
                <td className="px-3 py-2">{formatBrl(user.netRevenueBrl)}</td>
                <td className="px-3 py-2 text-amber-700">{user.loss ? "prejuízo" : ""}</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </Container>
  );
}
