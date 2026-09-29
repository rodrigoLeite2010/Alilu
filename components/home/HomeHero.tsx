import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";
import { HomeSearch } from "@/components/home/HomeSearch";

/**
 * Primeira dobra da Home: mensagem curta (o que é o Alilu + o que dá para
 * fazer aqui) e a busca do catálogo em destaque, para quem já sabe o que
 * procura. Sem imagens grandes nem animação — só texto e um card branco,
 * para não pesar o carregamento.
 */
export function HomeHero() {
  return (
    <section className="border-b border-zinc-200 bg-white">
      <Container className="py-16 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-800">
            Grátis e em português
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-zinc-900 sm:text-5xl">
            Ferramentas simples para facilitar o seu dia a dia.
          </h1>
          <p className="mt-4 text-lg text-zinc-600">
            Geradores, PDFs, finanças, Instagram, validadores e dezenas de utilitários online em um só lugar.
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Use gratuitamente, direto pelo navegador — a maioria das ferramentas não exige cadastro.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/utilitarios">Explorar ferramentas</LinkButton>
            <LinkButton href="#categorias" variant="secondary">
              Ver categorias
            </LinkButton>
          </div>
        </div>
        <div className="mt-10">
          <HomeSearch />
        </div>
      </Container>
    </section>
  );
}
