interface Template {
  slug: string;
  title: string;
  description: string;
}

const TEMPLATES: Template[] = [
  {
    slug: "orcamento-mensal",
    title: "Orçamento mensal",
    description: "Uma linha por receita ou despesa, com categoria, valor, data e recorrência — o mesmo modelo do painel mensal.",
  },
  {
    slug: "planejamento-anual",
    title: "Planejamento anual",
    description: "Receitas, despesas e saldo mês a mês, com totais do ano calculados sozinhos (na versão XLSX).",
  },
  {
    slug: "controle-de-dividas",
    title: "Controle de dívidas",
    description: "Saldo devedor e parcela mensal; parcelas restantes e previsão de término calculam sozinhos (na versão XLSX).",
  },
  {
    slug: "metodo-envelopes",
    title: "Método dos envelopes",
    description: "As categorias de despesa já preenchidas, para definir um limite mensal e acompanhar o quanto falta em cada uma.",
  },
];

/**
 * "Planilhas financeiras": modelos estáticos para baixar (não usam dados
 * do usuário nem o banco — arquivos em public/planilhas/, gerados uma
 * única vez). A versão XLSX tem fórmulas simples (soma, restante,
 * previsão de término); a versão CSV é só o cabeçalho + um exemplo, para
 * quem prefere abrir em qualquer programa de planilha.
 */
export function PlanilhasDownloads() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Prefere trabalhar numa planilha? Baixe os modelos abaixo — os mesmos conceitos das ferramentas do site, prontos para preencher no Excel,
        Google Planilhas ou LibreOffice.
      </p>

      <ul className="space-y-3">
        {TEMPLATES.map((template) => (
          <li key={template.slug} className="rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900">{template.title}</h3>
            <p className="mt-1 text-xs text-zinc-600">{template.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`/planilhas/${template.slug}.xlsx`}
                download
                className="inline-flex min-h-9 items-center rounded-md bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800"
              >
                Baixar XLSX
              </a>
              <a
                href={`/planilhas/${template.slug}.csv`}
                download
                className="inline-flex min-h-9 items-center rounded-md px-3 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
              >
                Baixar CSV
              </a>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-zinc-500">
        Os modelos não têm nenhum dado seu — é um ponto de partida em branco (com um ou dois exemplos), para preencher do seu jeito.
      </p>
    </div>
  );
}
