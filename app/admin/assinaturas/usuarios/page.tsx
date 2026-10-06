import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { getAdminSession } from "@/lib/admin/admin-access";
import { listBillingUsers, STATUS_FILTERS } from "@/lib/billing/backend/admin-users-service";
import { PLAN_CODES, PLAN_DEFINITIONS, formatPriceBrl } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · Usuários e planos", robots: { index: false, follow: false } };

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Pagando",
  PAST_DUE: "Em atraso",
  PENDING_PAYMENT: "Aguardando pagamento",
  CANCELED: "Cancelado",
  TRIAL: "Em teste",
  EXPIRED: "Expirado",
  SEM_ASSINATURA: "Sem assinatura",
};

interface PageProps {
  searchParams: Promise<{ q?: string; plano?: string; situacao?: string; pagina?: string }>;
}

function fmtDate(value: Date | null): string {
  return value ? value.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";
}

function href(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "" && !(key === "pagina" && value === 1)) search.set(key, String(value));
  }
  const text = search.toString();
  return `/admin/assinaturas/usuarios${text ? `?${text}` : ""}`;
}

/** Admin > Assinaturas > Usuários: quem logou, que plano tem e a situação de pagamento (consulta). */
export default async function AdminBillingUsersPage({ searchParams }: PageProps) {
  if (!(await getAdminSession())) notFound();
  const params = await searchParams;
  const data = await listBillingUsers({ q: params.q, plan: params.plano, status: params.situacao, page: Number(params.pagina) || 1 });
  const { q, plan, status } = data.filters;
  const base = { q, plano: plan, situacao: status };

  return (
    <Container className="max-w-6xl py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">Usuários e planos</h1>
        <Link href="/admin/assinaturas" className="text-sm font-medium text-teal-800 hover:underline">
          ← Assinaturas e receita
        </Link>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {data.total.toLocaleString("pt-BR")} usuário(s) com esse filtro. Consulta apenas — alterações de plano e cobrança são feitas no Asaas.
      </p>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-zinc-500">Buscar e-mail ou nome</span>
          <input name="q" defaultValue={q} className="min-h-10 w-64 rounded-md border border-zinc-300 px-3 text-sm" placeholder="ex.: maria@" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-zinc-500">Plano</span>
          <select name="plano" defaultValue={plan ?? ""} className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm">
            <option value="">Todos</option>
            {PLAN_CODES.map((code) => (
              <option key={code} value={code}>
                {PLAN_DEFINITIONS[code].name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-zinc-500">Situação</span>
          <select name="situacao" defaultValue={status ?? ""} className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm">
            <option value="">Todas</option>
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-10 rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white">
          Filtrar
        </button>
        <Link href={href({ situacao: "ACTIVE" })} className="min-h-10 self-end py-2 text-sm font-medium text-teal-800 hover:underline">
          Só quem está pagando
        </Link>
      </form>

      <div className="mt-5 overflow-x-auto rounded-md border border-zinc-200">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              {["Usuário", "Cadastro", "Plano", "Situação", "Renova / acesso até", "IA no ciclo", "Créditos"].map((label) => (
                <th key={label} className="px-3 py-2">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 tabular-nums">
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                  Nenhum usuário com esse filtro.
                </td>
              </tr>
            ) : (
              data.rows.map((row) => (
                <tr key={row.userId} className={row.status === "PAST_DUE" ? "bg-amber-50" : undefined}>
                  <td className="px-3 py-2">
                    <span className="block font-medium text-zinc-900">{row.email}</span>
                    {row.name ? <span className="block text-xs text-zinc-500">{row.name}</span> : null}
                  </td>
                  <td className="px-3 py-2">{fmtDate(row.createdAt)}</td>
                  <td className="px-3 py-2">
                    {row.planCode && (row.status === "ACTIVE" || row.status === "PAST_DUE" || row.status === "CANCELED") ? (
                      <>
                        {PLAN_DEFINITIONS[row.planCode].name}
                        <span className="block text-xs text-zinc-500">
                          {formatPriceBrl(row.priceCents ?? PLAN_DEFINITIONS[row.planCode].priceCents)}/mês
                          {row.pendingPlanCode ? ` → ${PLAN_DEFINITIONS[row.pendingPlanCode].name} no próximo ciclo` : ""}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">{STATUS_LABEL[row.status ?? "SEM_ASSINATURA"] ?? row.status}</td>
                  <td className="px-3 py-2">
                    {row.status === "TRIAL" ? `teste até ${fmtDate(row.trialEndsAt)}` : fmtDate(row.currentPeriodEndsAt)}
                    {row.status === "CANCELED" && row.canceledAt ? <span className="block text-xs text-zinc-500">cancelou em {fmtDate(row.canceledAt)}</span> : null}
                  </td>
                  <td className="px-3 py-2">{row.aiUsed !== null && row.aiLimit !== null ? `${row.aiUsed} de ${row.aiLimit}` : "—"}</td>
                  <td className="px-3 py-2">{row.credits.toLocaleString("pt-BR")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data.pageCount > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Paginação">
          {data.page > 1 ? (
            <Link href={href({ ...base, pagina: data.page - 1 })} className="font-medium text-teal-800 hover:underline">
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-zinc-500">
            Página {data.page} de {data.pageCount}
          </span>
          {data.page < data.pageCount ? (
            <Link href={href({ ...base, pagina: data.page + 1 })} className="font-medium text-teal-800 hover:underline">
              Próxima →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </Container>
  );
}
