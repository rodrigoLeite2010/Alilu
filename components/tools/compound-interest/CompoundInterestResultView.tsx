import { ResultHighlight } from "@/components/results/ResultHighlight";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { BalanceChart } from "@/components/tools/compound-interest/BalanceChart";
import { formatCurrencyBRL } from "@/lib/formatters/currency";
import type { CompoundInterestResult } from "@/lib/calculators/compound-interest";

/**
 * Exibe o resultado da Calculadora de Juros Compostos: valor final em
 * destaque, detalhamento (valor inicial, total aportado, total investido,
 * juros acumulados), gráfico de evolução, tabela mês a mês e o aviso de que
 * se trata de uma simulação (ETAPA 3, seções "RESULTADOS" e "CONTEÚDO").
 */
export function CompoundInterestResultView({
  result,
}: {
  result: CompoundInterestResult;
}) {
  const { details, months, finalAmount, assumptions } = result;

  return (
    <div className="mt-8 space-y-6">
      <ResultHighlight label="Valor final" value={formatCurrencyBRL(finalAmount)} />

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 p-3">
          <dt className="text-xs text-zinc-500">
            Valor inicial
          </dt>
          <dd className="mt-1 text-sm font-semibold text-zinc-900">
            {formatCurrencyBRL(details.initialAmount)}
          </dd>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3">
          <dt className="text-xs text-zinc-500">
            Total aportado
          </dt>
          <dd className="mt-1 text-sm font-semibold text-zinc-900">
            {formatCurrencyBRL(details.totalContributed)}
          </dd>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3">
          <dt className="text-xs text-zinc-500">
            Total investido
          </dt>
          <dd className="mt-1 text-sm font-semibold text-zinc-900">
            {formatCurrencyBRL(details.totalInvested)}
          </dd>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3">
          <dt className="text-xs text-zinc-500">
            Juros acumulados
          </dt>
          <dd className="mt-1 text-sm font-semibold text-emerald-700">
            {formatCurrencyBRL(details.totalInterest)}
          </dd>
        </div>
      </dl>

      {assumptions && assumptions.length > 0 ? (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          {assumptions.join("")}
        </p>
      ) : null}

      <div>
        <SectionHeading
          title="Evolução do saldo"
          description="Área escura: capital investido. Área clara: juros acumulados."
          as="h3"
        />
        <BalanceChart initialAmount={details.initialAmount} months={months} />
      </div>

      <div>
        <SectionHeading title="Detalhamento mês a mês" as="h3" />
        {/*
          Correção pré-commit (ETAPA 3, item BAIXO): a tabela tem 5 colunas
          de valores monetários, largas demais para telas estreitas. O
          container abaixo permite rolagem tanto vertical (linhas) quanto
          horizontal (colunas) sem remover nenhuma coluna nem espremer o
          texto; a tabela mantém uma largura mínima confortável e rola para
          o lado em vez de cortar ou quebrar os valores.
        */}
        <div className="max-h-80 overflow-auto rounded-lg border border-zinc-200">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Mês</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Saldo inicial</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Juros</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Aporte</th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">Saldo final</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => (
                <tr
                  key={month.month}
                  className="border-t border-zinc-100"
                >
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                    {month.month}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                    {formatCurrencyBRL(month.startingBalance)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                    {formatCurrencyBRL(month.interest)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                    {formatCurrencyBRL(month.contribution)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-zinc-900">
                    {formatCurrencyBRL(month.endingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
