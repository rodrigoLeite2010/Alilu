import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { FinanceShell } from "@/components/financas/FinanceShell";

// Dados financeiros pessoais: nunca indexar (ver também app/robots.ts).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function FinanceiroPrivadoLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/entrar?callbackUrl=${encodeURIComponent("/financeiro/meu-orcamento")}`);
  }
  return <FinanceShell>{children}</FinanceShell>;
}
