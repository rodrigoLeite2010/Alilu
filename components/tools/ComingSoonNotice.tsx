import { ResultHighlight } from "@/components/results/ResultHighlight";

/**
 * Área principal exibida para ferramentas com status "em-breve": ocupa o
 * mesmo espaço que o formulário + resultado de uma ferramenta pronta, para
 * que a página inteira já demonstre o layout final (PROMPT MESTRE, seção 6),
 * sem simular um cálculo real.
 */
export function ComingSoonNotice({ toolName }: { toolName: string }) {
  return (
    <div className="space-y-4">
      <ResultHighlight label="Pré-visualização do resultado" value="—" placeholder />
      <p className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
        A calculadora <strong>{toolName}</strong> ainda está em desenvolvimento
        e em breve estará disponível gratuitamente aqui. Enquanto isso,
        explore as outras ferramentas já organizadas no catálogo.
      </p>
    </div>
  );
}
