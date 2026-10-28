import Link from "next/link";
import type { ReactNode } from "react";
import "./imoveis.css";
export default function PropertyLayout({ children }: { children: ReactNode }) {
  return (
    <div className="property-portal mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <nav
        aria-label="Imóveis"
        className="mb-8 flex flex-wrap items-center gap-3 border-b border-zinc-200 pb-5 text-sm text-brand-primary"
      >
        <Link href="/imoveis" className="mr-auto text-xl font-bold">
          Alilu <span className="font-normal">Imóveis</span>
        </Link>
        <Link href="/imoveis/favoritos">Favoritos</Link>
        <Link href="/imoveis/meus-anuncios">Meus anúncios</Link>
        <Link href="/imoveis/anunciar" className="estate-button">
          Anunciar grátis
        </Link>
      </nav>
      {children}
      <p className="mt-12 border-t border-zinc-200 pt-6 text-xs leading-relaxed text-zinc-500">
        A Alilu é uma plataforma de divulgação. O contato e a negociação
        acontecem diretamente com o anunciante. A moderação não certifica o
        imóvel, a documentação ou o anunciante. Confira as informações antes de
        negociar.{" "}
        <Link href="/termos-de-uso" className="underline">
          Termos de uso
        </Link>{" "}
        ·{" "}
        <Link href="/privacidade" className="underline">
          Privacidade
        </Link>
      </p>
    </div>
  );
}
