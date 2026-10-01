import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { getAdminSession } from "@/lib/admin/admin-access";
import { getCostsDashboard, type CostPeriodSummary } from "@/lib/ai-video/backend/admin-service";
import { formatBrl } from "@/lib/ai-video/pricing";
import { AI_VIDEO_TIER_LABEL, type AiVideoTier } from "@/lib/ai-video/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · IA · Custos", robots: { index: false, follow: false } };

function Period({ title, data }: { title: string; data: CostPeriodSummary }) {
  const items: [string, string][] = [
    ["Gerações", String(data.generations)],
    ["Concluídas / falhas", `${data.completed} / ${data.failed}`],
    ["Receita (créditos consumidos)", formatBrl(data.revenueAllocatedBrl)],
    ["Custo de API", formatBrl(data.apiCostBrl)],
    ["Taxas de pagamento e impostos", formatBrl(data.paymentAndTaxBrl)],
    ["Custo de falhas cobradas", formatBrl(data.failureCostBrl)],
    ["Lucro bruto", formatBrl(data.grossProfitBrl)],
    ["Margem", `${data.grossMarginPct.toFixed(1)}%`],
    ["Custo médio por vídeo", formatBrl(data.averageCostPerVideoBrl)],
    ["Tempo médio de geração", data.averageGenerationSeconds === null ? "—" : `${Math.round(data.averageGenerationSeconds)} s`],
    ["Créditos consumidos / devolvidos", `${data.creditsConsumed} / ${data.creditsRefunded}`],
    ["Compras pagas", `${data.purchasesCount} · ${formatBrl(data.purchasesRevenueBrl)}`],
    ["Gasto com os provedores", `US$ ${data.providerSpendUsd.toFixed(2)}`],
    ["Taxa de erro", `${data.errorRatePct.toFixed(1)}%`],
    ["Regenerações com desconto", `${data.retries} (${data.retryRatePct.toFixed(1)}% das concluídas)`],
    ["Problemas reportados", String(data.issuesReported)],
    ["“Gostei”", String(data.liked)],
  ];
  return (
    <section className="rounded-lg border border-zinc-200 p-4">
      <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 border-b border-zinc-100 pb-1">
            <dt className="text-zinc-600">{label}</dt>
            <dd className="font-medium text-zinc-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Admin > IA > Custos de geração. Receita = créditos consumidos × valor do crédito (receita reconhecida no uso). */
export default async function AdminAiCostsPage() {
  if (!(await getAdminSession())) notFound();
  const data = await getCostsDashboard();
  return (
    <Container className="max-w-5xl py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">IA · Custos de geração</h1>
        <Link href="/admin/ia/precificacao" className="text-sm font-medium text-teal-800 hover:underline">
          ← Precificação
        </Link>
      </div>
      {data.alerts.length > 0 ? (
        <ul className="mt-4 space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {data.alerts.map((alert) => (
            <li key={alert}>⚠ {alert}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-6 grid gap-4">
        <Period title="Hoje (UTC)" data={data.today} />
        <Period title="Este mês (UTC)" data={data.month} />
      </div>
      <section className="mt-6">
        <h2 className="text-base font-semibold text-zinc-900">Por qualidade e modelo (mês)</h2>
        <div className="mt-2 overflow-x-auto rounded-md border border-zinc-200">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Qualidade / modelo</th>
                <th className="px-3 py-2">Gerações</th>
                <th className="px-3 py-2">Custo médio</th>
                <th className="px-3 py-2">Créditos</th>
                <th className="px-3 py-2">Receita</th>
                <th className="px-3 py-2">Lucro</th>
                <th className="px-3 py-2">Margem</th>
              </tr>
            </thead>
            <tbody>
              {data.byModel.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-zinc-500">
                    Nenhuma geração concluída neste mês.
                  </td>
                </tr>
              ) : (
                data.byModel.map((row) => (
                  <tr key={`${row.tier}-${row.provider}-${row.model}`} className="border-t border-zinc-100">
                    <td className="px-3 py-2">
                      <span className="font-medium">{AI_VIDEO_TIER_LABEL[row.tier as AiVideoTier] ?? row.tier}</span>
                      <span className="block text-xs text-zinc-500">
                        {row.provider} · {row.model}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.generations}</td>
                    <td className="px-3 py-2">{formatBrl(row.averageCostBrl)}</td>
                    <td className="px-3 py-2">{row.creditsConsumed}</td>
                    <td className="px-3 py-2">{formatBrl(row.revenueBrl)}</td>
                    <td className="px-3 py-2">{formatBrl(row.grossProfitBrl)}</td>
                    <td className="px-3 py-2">{row.grossMarginPct.toFixed(1)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      {data.usersForReview.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-base font-semibold text-zinc-900">Usuários para revisão (muitos reportes em 30 dias)</h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-700">
            {data.usersForReview.map((user) => (
              <li key={user.email}>
                {user.email} — {user.reports} reportes, {user.refunds} com devolução
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="mt-6 text-sm text-zinc-600">
        Bônus de boas-vindas concedidos no mês: {data.welcomeBonusCredits} créditos · Créditos de estorno/contestação já
        usados (não recuperados): {data.unrecoveredCredits}.
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Reconciliação: compare “Gasto com o provedor” com o uso mostrado nos portais da Runway e do fal.ai — o custo por
        geração aqui é o da tabela de preço vigente no envio (a API não informa o custo de cada tarefa).
      </p>
    </Container>
  );
}
