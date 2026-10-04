import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { getAdminSession } from "@/lib/admin/admin-access";
import { getInstagramDiagnostics } from "@/lib/instagram/backend/oauth-diagnostics";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin · Instagram / Meta", robots: { index: false, follow: false } };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

/** Admin › Instagram / Meta — diagnóstico do login (nunca mostra token). */
export default async function AdminInstagramPage() {
  const admin = await getAdminSession();
  if (!admin) notFound();
  const diag = await getInstagramDiagnostics(admin.userId);
  return (
    <Container className="max-w-4xl py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">Instagram / Meta — Diagnóstico</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Passo a passo da configuração em <code>docs/meta-instagram-production.md</code>. Permissões pedidas: {diag.scopes.join(", ")}.
      </p>

      <ul className="mt-6 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
        {diag.checks.map((check) => (
          <li key={check.label} className="flex gap-3 px-4 py-3 text-sm">
            <span
              className={`mt-0.5 w-5 shrink-0 text-center font-bold ${check.ok === true ? "text-green-700" : check.ok === false ? "text-red-700" : "text-zinc-400"}`}
              aria-label={check.ok === true ? "ok" : check.ok === false ? "problema" : "não se aplica"}
            >
              {check.ok === true ? "✓" : check.ok === false ? "✗" : "–"}
            </span>
            <span>
              <span className="font-medium text-zinc-900">{check.label}</span>
              <span className="block break-all text-xs text-zinc-500">{check.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Contas no Alilu</h2>
        <p className="mt-2 text-sm text-zinc-700">
          Conectadas: <strong>{diag.accounts.connected}</strong> · Expiradas: <strong>{diag.accounts.expired}</strong> · Desconectadas:{" "}
          <strong>{diag.accounts.revoked}</strong> · Com erro: <strong>{diag.accounts.error}</strong>
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Últimos erros / cancelamentos do login</h2>
        <ul className="mt-2 divide-y divide-zinc-100 text-sm">
          {diag.recentEvents.map((event, index) => (
            <li key={index} className="py-2">
              <span className="text-zinc-500">{dateFmt.format(new Date(event.at))}</span> · {event.stage} · <strong>{event.outcome}</strong>
              {event.code ? ` · código ${event.code}` : ""}
              {event.type ? ` · ${event.type}` : ""}
              {event.message ? <span className="block text-xs text-zinc-500">{event.message}</span> : null}
            </li>
          ))}
          {!diag.recentEvents.length ? <li className="py-2 text-zinc-500">Nenhum erro registrado.</li> : null}
        </ul>
        <p className="mt-3 text-xs text-zinc-500">
          “Insufficient developer role” / “Função de desenvolvedor é insuficiente” aparece na tela da própria Meta (não volta para o Alilu) quando o
          app está em modo Desenvolvimento ou sem Acesso Avançado e a conta que tentou entrar não tem função no app.
        </p>
      </section>
    </Container>
  );
}
