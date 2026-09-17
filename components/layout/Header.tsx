import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SiteNav } from "@/components/navigation/SiteNav";
import { SITE_NAME } from "@/lib/seo/site";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur print:hidden">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md text-base font-semibold tracking-tight text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ícone
              pequeno e fixo (32x32); o projeto não usa next/image em
              nenhum outro lugar (só ícones Lucide como componente), então
              uma <img> simples evita introduzir a config de otimização de
              imagens só para este caso. */}
          <img
            src="/logo-icon.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-md"
          />
          {SITE_NAME}
        </Link>
        <SiteNav />
      </Container>
    </header>
  );
}
