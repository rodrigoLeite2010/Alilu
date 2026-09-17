import { ResultHighlight } from "@/components/results/ResultHighlight";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { FinancingBalanceChart } from "@/components/tools/financing/FinancingBalanceChart";
import { formatCurrencyBRL } from "@/lib/formatters/currency";
import type {
  FinancingInstallment,
  FinancingResult,
  FinancingSystemResult,
} from "@/lib/calculators/financing";

function SystemSummaryCard({
  title,
  data,
}: {
  title: string;
  data: FinancingSystemResult;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <h3 className="text-sm font-semibold text-zinc-900">
        {title}
      </h3>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-zinc-500">
            Primeira parcela
          </dt>
          <dd className="mt-0.5 text-sm font-semibold text-zinc-900">
            {formatCurrencyBRL(data.firstPayment)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">
            Última parcela
          </dt>
          <dd className="mt-0.5 text-sm font-semibold text-zinc-900">
            {formatCurrencyBRL(data.lastPayment)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">
            Total pago
          </dt>
          <dd className="mt-0.5 text-sm font-semibold text-zinc-900">
            {formatCurrencyBRL(data.totalPaid)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">
            Total de juros
          </dt>
          <dd className="mt-0.5 text-sm font-semibold text-emerald-700">
            {formatCurrencyBRL(data.totalInterest)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function AmortizationTable({
  title,
  rows,
}: {
  title: string;
  rows: FinancingInstallment[];
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-zinc-900">
        {title}
      </h3>
      {/*
        Tabela com várias colunas de valores monetários: em telas estreitas
        rola horizontalmente (overflow-x-auto) em vez de espremer o texto,
        seguindo o mesmo padrão já usado na Calculadora de Juros Compostos.
      */}
      <div className="max-h-80 overflow-auto rounded-lg border border-zinc-200">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="sticky top-0 bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Parcela</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Prestação</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Juros</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Amortização</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Saldo devedor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.number}
                className="border-t border-zinc-100"
              >
                <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                  {row.number}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                  {formatCurrencyBRL(row.payment)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                  {formatCurrencyBRL(row.interest)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                  {formatCurrencyBRL(row.amortization)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-medium text-zinc-900">
                  {formatCurrencyBRL(Math.max(row.balance, 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Exibe o resultado do Simulador de Financiamento SAC x Price: valor
 * financiado em destaque, resumo por sistema (lado a lado no desktop,
 * empilhado no celular quando "Comparar os dois" está selecionado),
 * gráfico de evolução do saldo devedor e tabela(s) de amortização
 * (ETAPA 4, seção "RESULTADO").
 */
export function FinancingResultView({ result }: { result: FinancingResult }) {
  const { price, sac, financedAmount } = result;
  const systemCount = (price ? 1 : 0) + (sac ? 1 : 0);

  return (
    <div className="mt-8 space-y-6">
      <ResultHighlight
        label="Valor financiado"
        value={formatCurrencyBRL(financedAmount)}
      />

      <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
        Esta é uma simulação matemática dos sistemas SAC e Price. Nenhum
        sistema é sempre &quot;melhor&quot; — as diferenças matemáticas estão
        mostradas abaixo para você decidir. Financiamentos reais podem
        incluir tarifas, seguros, impostos, o Custo Efetivo Total (CET) e
        outras condições não consideradas nesta simulação.
      </p>

      <div
        className={`grid grid-cols-1 gap-4 ${
          systemCount > 1 ? "md:grid-cols-2" : ""
        }`}
      >
        {price ? <SystemSummaryCard title="Tabela Price" data={price} /> : null}
        {sac ? <SystemSummaryCard title="SAC" data={sac} /> : null}
      </div>

      <div>
        <SectionHeading
          title="Evolução do saldo devedor"
          description={
            systemCount > 1
              ? "Linha azul: Price. Linha verde: SAC."
              : undefined
          }
          as="h3"
        />
        <FinancingBalanceChart
          financedAmount={financedAmount}
          price={price?.installments}
          sac={sac?.installments}
        />
      </div>

      <div
        className={`grid grid-cols-1 gap-6 ${
          systemCount > 1 ? "lg:grid-cols-2" : ""
        }`}
      >
        {price ? (
          <AmortizationTable
            title="Tabela de amortização — Price"
            rows={price.installments}
          />
        ) : null}
        {sac ? (
          <AmortizationTable
            title="Tabela de amortização — SAC"
            rows={sac.installments}
          />
        ) : null}
      </div>
    </div>
  );
}
