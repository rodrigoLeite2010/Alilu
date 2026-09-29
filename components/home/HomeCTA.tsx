import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";

/**
 * CTA final antes do rodapé. "Sugerir uma ferramenta" aponta para /contato
 * — a página de contato já existente, cujo próprio texto convida
 * explicitamente a sugestões de novas ferramentas (ver app/contato/page.tsx).
 * Não existe uma rota dedicada só para sugestões, então não inventamos uma.
 */
export function HomeCTA() {
  return (
    <section className="bg-white">
      <Container className="py-12 text-center sm:py-16">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Não encontrou o que precisava?</h2>
        <p className="mx-auto mt-3 max-w-md text-zinc-600">O Alilu está sempre ganhando novas ferramentas.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <LinkButton href="/utilitarios">Explorar todas as ferramentas</LinkButton>
          <LinkButton href="/contato" variant="secondary">
            Sugerir uma ferramenta
          </LinkButton>
        </div>
      </Container>
    </section>
  );
}
