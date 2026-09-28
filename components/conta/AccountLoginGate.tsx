import Link from "next/link";
import { CheckCircle2, Lock } from "lucide-react";

/**
 * Tela mostrada em /minha-conta quando não há sessão — mesmo padrão visual
 * do FinanceLoginGate (components/financas/FinanceLoginGate.tsx), mas com
 * texto específico da própria conta: deixa claro que as ferramentas
 * continuam livres sem login, e que entrar aqui é só para ver/gerenciar a
 * conta. `returnPath` manda de volta para /minha-conta depois do login.
 */
export function AccountLoginGate({ returnPath }: { returnPath: string }) {
  const href = `/entrar?callbackUrl=${encodeURIComponent(returnPath)}`;

  return (
    <section className="mx-auto max-w-lg rounded-lg border border-teal-200 bg-teal-50/50 p-6 text-center sm:p-8">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-teal-800">
        <Lock className="h-5 w-5" aria-hidden />
      </span>
      <h1 className="mt-3 text-xl font-semibold text-zinc-900">Entre para ver sua conta</h1>
      <p className="mt-2 text-sm text-zinc-600">
        As ferramentas do ALILU continuam livres para usar sem login. Entrar é só para ver os dados da sua conta e
        acessar o que fica salvo nela — como o Controle financeiro e as automações do Instagram.
      </p>
      <ul className="mt-4 space-y-1.5 text-left text-sm text-zinc-700">
        {[
          "Veja seu nome, e-mail e como você entra no site",
          "Acesse o Controle financeiro e as automações do Instagram",
          "Saia da conta a qualquer momento, num só clique",
        ].map((item) => (
          <li key={item} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        Entrar ou criar conta
      </Link>
    </section>
  );
}
