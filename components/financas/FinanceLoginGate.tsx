import Link from "next/link";
import { CheckCircle2, Lock } from "lucide-react";

/**
 * Tela mostrada em vez do conteúdo privado quando não há sessão — explica
 * por que é preciso entrar (dados salvos por conta, para não perder nada)
 * e como entrar (Google ou código por e-mail), antes de mandar para
 * /entrar. `returnPath` é a própria URL da página, para voltar direto a
 * ela depois do login (em vez de sempre cair no painel principal).
 */
export function FinanceLoginGate({ returnPath }: { returnPath: string }) {
  const href = `/entrar?callbackUrl=${encodeURIComponent(returnPath)}`;

  return (
    <section className="mx-auto max-w-lg rounded-lg border border-teal-200 bg-teal-50/50 p-6 text-center sm:p-8">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-teal-800">
        <Lock className="h-5 w-5" aria-hidden />
      </span>
      <h1 className="mt-3 text-xl font-semibold text-zinc-900">Entre para acessar sua Educação Financeira</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Seus lançamentos, metas e contas ficam salvos na sua conta — assim você não perde nada e pode acessar de qualquer aparelho.
      </p>
      <ul className="mt-4 space-y-1.5 text-left text-sm text-zinc-700">
        {[
          "Entre com sua conta Google",
          "Ou crie uma conta grátis só com seu e-mail, recebendo um código de 6 dígitos",
          "Seus dados ficam só na sua conta — ninguém mais acessa",
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
