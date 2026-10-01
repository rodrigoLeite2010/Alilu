/**
 * Variáveis dos prompts do Piloto Automático — substituídas ANTES de o
 * texto ir para a IA (ou, no modo manual, antes de ser desenhado/
 * publicado). Funciona para qualquer tipo de conteúdo (Post, Carrossel,
 * Reel, Story). Variável desconhecida fica como está (nunca some
 * silenciosamente um trecho que o usuário escreveu).
 *
 *   {{diaSemana}}  dia da semana do horário (ex.: "Segunda-feira")
 *   {{data}}       data da execução no fuso da automação (dd/mm/aaaa)
 *   {{hora}}       horário configurado (HH:mm)
 *   {{nomeConta}}  @ da conta do Instagram (sem o @)
 *   {{tema}}       nome da automação
 *   {{categoria}}  categoria do horário (ex.: "Financeiro"), ou vazio
 *   {{urlSite}}    endereço do site (NEXT_PUBLIC_SITE_URL, padrão www.alilu.com.br)
 *
 * Módulo puro (sem "server-only") — também usado pela tela, para mostrar
 * a lista de variáveis disponíveis.
 */

export interface PromptVariableContext {
  diaSemana: string;
  /** "YYYY-MM-DD" — formatada aqui como dd/mm/aaaa. */
  runDate: string;
  hora: string;
  nomeConta: string | null;
  tema: string;
  categoria: string | null;
  urlSite: string;
}

export const PROMPT_VARIABLES = [
  "diaSemana",
  "data",
  "hora",
  "nomeConta",
  "tema",
  "categoria",
  "urlSite",
] as const;

export type PromptVariableName = (typeof PROMPT_VARIABLES)[number];

export const PROMPT_VARIABLE_HELP: Record<PromptVariableName, string> = {
  diaSemana: "dia da semana",
  data: "data (dd/mm/aaaa)",
  hora: "horário de publicação",
  nomeConta: "nome da conta do Instagram",
  tema: "nome da automação",
  categoria: "categoria do horário",
  urlSite: "endereço do site",
};

export const DEFAULT_SITE_URL = "www.alilu.com.br";

function formatRunDate(runDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(runDate);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : runDate;
}

/** Remove o protocolo e a barra final — "https://alilu.com.br/" vira "alilu.com.br" (mais natural num texto). */
export function displaySiteUrl(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return DEFAULT_SITE_URL;
  return value.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

export function applyPromptVariables(text: string, context: PromptVariableContext): string {
  if (!text || !text.includes("{{")) return text;
  const values: Record<PromptVariableName, string> = {
    diaSemana: context.diaSemana,
    data: formatRunDate(context.runDate),
    hora: context.hora,
    nomeConta: (context.nomeConta ?? "").replace(/^@/, ""),
    tema: context.tema,
    categoria: context.categoria ?? "",
    urlSite: context.urlSite,
  };
  return text.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (whole, name: string) =>
    (PROMPT_VARIABLES as readonly string[]).includes(name) ? values[name as PromptVariableName] : whole,
  );
}
