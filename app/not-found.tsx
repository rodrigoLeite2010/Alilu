import { Container } from "@/components/ui/Container";
import { LinkButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center py-24 text-center">
      <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
        Erro 404
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
        Página não encontrada
      </h1>
      <p className="mt-2 max-w-md text-base text-zinc-600 dark:text-zinc-400">
        A página que você procura não existe ou foi movida. Volte para o
        catálogo e encontre a ferramenta certa para você.
      </p>
      <div className="mt-6">
        <LinkButton href="/utilitarios">Ver todas as ferramentas</LinkButton>
      </div>
    </Container>
  );
}
