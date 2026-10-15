import type { Metadata } from "next";

// O crawler precisa acessar esta tela para observar o noindex no HTML.
export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
