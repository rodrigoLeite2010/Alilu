import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { getAdminSession } from "@/lib/admin/admin-access";
import { getBillingMetrics, type BillingMetrics } from "@/lib/billing/backend/admin-metrics-service";
import { formatBrl } from "@/lib/ai-video/pricing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · Assinaturas e receita", robots: { index: false, follow: false } };

const brlFromCents = (cents: number) => formatBrl(cents / 100);
const int = (value: number) => value.toLocaleString("pt-BR");

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

function costLabel(value: number | null) {
  return value === null ? "—" : formatBrl(value);
}

function PlansTable({ data }: { data: BillingMetrics }) {
  return (
    <Table head={["Plano", "Assinantes", "MRR", "Em atraso", "Cancelados (c/ acesso)", "Downgrade agendado", "Custo IA texto (mês)", "Margem est."]}>
      {data.plans.map((plan) => (
        <tr key={plan.code}>
          <td className="px-3 py-2 font-medium text-zinc-900">
            {plan.name} <span className="font-normal text-zinc-500">{brlFromCents(plan.priceCents)}</span>
          </td>
          <td className="px-3 py-2">{int(plan.subscribers)}</td>
          <td className="px-3 py-2">{brlFromCents(plan.mrrCents)}</td>
          <td className="px-3 py-2">{plan.pastDue > 0 ? `${plan.pastDue} (${brlFromCents(plan.pastDueCents)})` : "0"}</td>
          <td className="px-3 py-2">{int(plan.canceledWithAccess)}</td>
          <td className="px-3 py-2">
            {plan.scheduledDowngrades > 0 ? `${plan.scheduledDowngrades} (−${brlFromCents(plan.scheduledDowngradeLossCents)})` : "0"}
          </td>
          <td className="px-3 py-2">{costLabel(plan.textCostBrl)}</td>
          <td className="px-3 py-2">{plan.marginPct === null ? "—" : `${plan.marginPct.toFixed(0)}%`}</td>
        </tr>
      ))}
    </Table>
  );
}

/** Admin > Assinaturas e receita: MRR, uso da franquia, créditos, custo de IA e margem estimada. */
export default async function AdminSubscriptionsPage() {
  if (!(await getAdminSession())) notFound();
  const data = await getBillingMetrics();
  const aiPlans = data.plans.filter((plan) => plan.aiUsage);

  return (
    <Container className="max-w-6xl py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">Assinaturas e receita</h1>
        <Link href="/admin/ia/custos" className="text-sm font-medium text-teal-800 hover:underline">
          IA · Custos de vídeo →
        </Link>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Atualizado em {new Date(data.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Mês = mês UTC, igual ao painel de custos.
      </p>

      {data.alerts.length > 0 ? (
        <ul className="mt-4 space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {data.alerts.map((alert) => (
            <li key={alert}>⚠ {alert}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="MRR" value={brlFromCents(data.mrr.totalCents)} hint={`Líquido estimado ${formatBrl(data.mrr.netBrl)} (após taxa e imposto)`} />
        <Stat label="Assinantes ativos" value={int(data.subscribers.active)} hint={`${int(data.subscribers.trial)} em teste · ${int(data.subscribers.pendingPayment)} aguardando pagamento`} />
        <Stat
          label="Em risco (atraso)"
          value={brlFromCents(data.mrr.atRiskCents)}
          hint={`${int(data.subscribers.pastDue)} assinante(s)`}
          tone={data.subscribers.pastDue > 0 ? "warn" : "default"}
        />
        <Stat
          label="Churn 30 dias"
          value={`${data.movement30d.churnPct.toFixed(1)}%`}
          hint={`${int(data.movement30d.newPaid)} novos · ${int(data.movement30d.canceled)} cancelados`}
        />
      </div>
      {data.mrr.scheduledDowngradeLossCents > 0 ? (
        <p className="mt-2 text-xs text-zinc-500">
          Downgrades agendados reduzem o MRR em {brlFromCents(data.mrr.scheduledDowngradeLossCents)} no próximo ciclo.
        </p>
      ) : null}

      <Section title="Planos" note="Margem estimada = (MRR líquido − custo de IA de texto do mês) ÷ MRR líquido. Não inclui o vídeo, que é cobrado por créditos.">
        <PlansTable data={data} />
      </Section>

      <Section title="Uso da franquia de IA (ciclo atual)">
        <Table head={["Plano", "Assinantes", "Publicações usadas", "Franquia total", "Uso médio", "≥ 80%", "Esgotaram"]}>
          {aiPlans.map((plan) => {
            const usage = plan.aiUsage!;
            const pct = usage.limitTotal > 0 ? (usage.usedTotal / usage.limitTotal) * 100 : 0;
            return (
              <tr key={plan.code}>
                <td className="px-3 py-2 font-medium text-zinc-900">{plan.name}</td>
                <td className="px-3 py-2">{int(usage.subscribers)}</td>
                <td className="px-3 py-2">{int(usage.usedTotal)}</td>
                <td className="px-3 py-2">{int(usage.limitTotal)}</td>
                <td className="px-3 py-2">{pct.toFixed(0)}%</td>
                <td className="px-3 py-2">{int(usage.nearLimit)}</td>
                <td className="px-3 py-2">{int(usage.atLimit)}</td>
              </tr>
            );
          })}
        </Table>
      </Section>

      <Section title="Créditos de IA">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Vendas no mês" value={formatBrl(data.credits.purchasedMonthBrl)} hint={`${int(data.credits.purchasesMonth)} compra(s) paga(s)`} />
          <Stat
            label="Créditos em aberto"
            value={int(data.credits.outstandingCredits)}
            hint={data.credits.creditValueBrl !== null ? `Passivo ≈ ${formatBrl(data.credits.outstandingLiabilityBrl)} (R$ ${data.credits.creditValueBrl.toFixed(2).replace(".", ",")}/crédito)` : undefined}
          />
          <Stat label="Não recuperados" value={int(data.credits.unrecoveredCredits)} hint="Estorno/chargeback de créditos já usados" tone={data.credits.unrecoveredCredits > 0 ? "warn" : "default"} />
          {data.video ? (
            <Stat
              label="Vídeo: margem do mês"
              value={`${data.video.grossMarginPct.toFixed(1)}%`}
              hint={`Lucro bruto ${formatBrl(data.video.grossProfitBrl)} · ${int(data.video.creditsConsumed)} créditos usados`}
            />
          ) : null}
        </div>
      </Section>

      <Section
        title="Custo de IA de texto (mês)"
        note="Tokens registrados em generation_usage (Piloto Automático e botão de IA). Usuário nunca é cobrado por token — é só análise interna."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Chamadas" value={int(data.textAi.calls)} />
          <Stat label="Tokens entrada / saída" value={`${int(data.textAi.tokensInput)} / ${int(data.textAi.tokensOutput)}`} />
          <Stat label="Custo estimado" value={costLabel(data.textAi.costBrl)} hint={data.textAi.pricingConfigured ? undefined : "Preço do modelo não configurado"} />
        </div>
        {data.textAi.byFeature.length > 0 ? (
          <div className="mt-3">
            <Table head={["Função", "Chamadas", "Tokens entrada", "Tokens saída", "Custo"]}>
              {data.textAi.byFeature.map((item) => (
                <tr key={item.feature}>
                  <td className="px-3 py-2 font-medium text-zinc-900">{item.feature}</td>
                  <td className="px-3 py-2">{int(item.calls)}</td>
                  <td className="px-3 py-2">{int(item.tokensInput)}</td>
                  <td className="px-3 py-2">{int(item.tokensOutput)}</td>
                  <td className="px-3 py-2">{costLabel(item.costBrl)}</td>
                </tr>
              ))}
            </Table>
          </div>
        ) : null}
      </Section>

      <Section title="Maiores consumidores de IA de texto (mês)" note="Marcados quando o custo estimado passa da mensalidade líquida do usuário.">
        {data.heavyUsers.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum uso registrado por usuário neste mês.</p>
        ) : (
          <Table head={["Usuário", "Plano", "Chamadas", "Tokens (ent./saída)", "Custo IA", "Mensalidade líq.", ""]}>
            {data.heavyUsers.map((user) => (
              <tr key={user.email} className={user.loss ? "bg-red-50" : undefined}>
                <td className="px-3 py-2 font-medium text-zinc-900">{user.email}</td>
                <td className="px-3 py-2">{user.planCode ?? "—"}{user.status ? ` · ${user.status}` : ""}</td>
                <td className="px-3 py-2">{int(user.calls)}</td>
                <td className="px-3 py-2">
                  {int(user.tokensInput)} / {int(user.tokensOutput)}
                </td>
                <td className="px-3 py-2">{costLabel(user.costBrl)}</td>
                <td className="px-3 py-2">{formatBrl(user.netRevenueBrl)}</td>
                <td className="px-3 py-2 font-medium text-red-700">{user.loss ? "Custo > receita" : ""}</td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </Container>
  );
}
