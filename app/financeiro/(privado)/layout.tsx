import type { Metadata } from "next";
import type { ReactNode } from "react";

// Dados financeiros pessoais: nunca indexar (ver também app/robots.ts).
// O login em si é exigido por FinancePage, em cada página — ver o
// componente para o porquê de não redirecionar aqui no layout.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function FinanceiroPrivadoLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
