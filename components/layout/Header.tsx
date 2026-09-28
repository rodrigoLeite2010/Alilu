import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SITE_NAME } from "@/lib/seo/site";
import { HeaderAuthArea } from "@/components/layout/HeaderAuthArea";

/**
 * O estado de login (Entrar / avatar+nome / menu mobile) vive inteiramente
 * dentro de HeaderAuthArea — um componente client que busca a sessão via
 * GET /api/auth/session no navegador. Propositalmente NÃO lemos `auth()`
 * aqui no Header (Server Component): isso obrigaria o layout raiz inteiro
 * a virar dinâmico (qualquer leitura de cookies() no caminho de render
 * tira a rota da geração estática), o que quebraria a pré-renderização
 * estática das +150 páginas públicas do catálogo. O pequeno custo é um
 * estado de carregamento breve no cabeçalho (ver HeaderAuthArea) — o
 * conteúdo da página em si nunca depende disso.
 */
export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur print:hidden">
      <Container className="flex h-16 max-w-[90rem] items-center justify-between gap-4">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 rounded-md text-base font-semibold tracking-tight text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
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
          <span className="truncate whitespace-nowrap">{SITE_NAME}</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/utilitarios"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 xl:block"
          >
            Catálogo completo
          </Link>
          <HeaderAuthArea />
        </div>
      </Container>
    </header>
  );
}
