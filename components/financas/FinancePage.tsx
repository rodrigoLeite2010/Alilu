import type { ReactNode } from "react";
import { auth } from "@/auth";
import { Container } from "@/components/ui/Container";
import { FinanceLoginGate } from "./FinanceLoginGate";
import { FinanceShell } from "./FinanceShell";

/**
 * Moldura de toda página privada de Educação Financeira: exige login (sem
 * redirecionar de cara — explica o porquê e como entrar, via
 * FinanceLoginGate) e, já logado, monta o título e o shell (abas +
 * "+ Adicionar gasto") em volta do conteúdo da ferramenta.
 *
 * `returnPath` é a própria URL da página (ex.: "/financeiro/despesas"),
 * para o login devolver o usuário exatamente onde ele queria ir.
 */
export async function FinancePage({
  returnPath,
  title,
  subtitle,
  children,
}: {
  returnPath: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <Container className="py-10 sm:py-14">
        <FinanceLoginGate returnPath={returnPath} />
      </Container>
    );
  }

  return (
    <FinanceShell>
      <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
      <p className="mb-6 mt-1 text-sm text-zinc-600">{subtitle}</p>
      {children}
    </FinanceShell>
  );
}
