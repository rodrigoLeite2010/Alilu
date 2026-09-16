import type { Tool } from "@/data/tools";

/**
 * Regra CENTRAL de publicação/indexação de uma ferramenta, baseada
 * exclusivamente no campo `status` do catálogo (data/tools.ts).
 *
 * Nenhuma outra parte do projeto deve decidir "na mão" se uma ferramenta é
 * indexável ou se deve aparecer no sitemap — todas devem reutilizar as
 * funções deste arquivo. Isso garante que o único gatilho necessário para
 * publicar uma ferramenta é alterar seu status no catálogo:
 *
 *   status: "em-breve"  ->  status: "ativo"
 *
 * status "em-breve": página continua acessível para o usuário, mas não deve
 * ser indexada pelos buscadores nem aparecer no sitemap (ainda não tem
 * ferramenta funcional nem conteúdo próprio suficiente).
 *
 * status "ativo": página publicada — indexável, aparece no sitemap, mantém
 * canonical e Open Graph normalmente.
 */
export function isToolPublished(tool: Pick<Tool, "status">): boolean {
  return tool.status === "ativo";
}

/** Filtra, dentre uma lista de ferramentas, apenas as publicadas/indexáveis. */
export function getPublishedTools<T extends Pick<Tool, "status">>(
  toolList: T[]
): T[] {
  return toolList.filter(isToolPublished);
}

/**
 * Metadata de robots para a página de uma ferramenta, derivada unicamente do
 * status. Ferramentas "em-breve" usam noindex (mas continuam permitindo
 * `follow`, para que os links internos do catálogo continuem sendo
 * rastreados); ferramentas "ativo" permitem indexação normalmente.
 */
export function getToolRobotsMeta(tool: Pick<Tool, "status">): {
  index: boolean;
  follow: boolean;
} {
  return {
    index: isToolPublished(tool),
    follow: true,
  };
}
