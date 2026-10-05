/**
 * Sugestões de troca por termos mais simples — SÓ sugestão, nunca aplicada
 * automaticamente. Chave: forma minúscula sem acento (ver complex-words.ts).
 */
const RAW: Array<[string, string]> = [
  ["utilizar", "usar"], ["utilização", "uso"], ["efetuar", "fazer"], ["realizar", "fazer"], ["adquirir", "comprar"],
  ["posteriormente", "depois"], ["anteriormente", "antes"], ["possibilitar", "permitir"], ["aproximadamente", "cerca de"],
  ["necessário", "preciso"], ["finalidade", "objetivo"], ["solicitar", "pedir"], ["visualizar", "ver"],
  ["encaminhar", "enviar"], ["disponibilizar", "oferecer"], ["implementar", "fazer"], ["mediante", "por meio de"],
  ["consequentemente", "por isso"], ["entretanto", "mas"], ["todavia", "mas"], ["contudo", "mas"], ["portanto", "então"],
  ["inúmeros", "muitos"], ["diversos", "vários"], ["primordial", "essencial"], ["imprescindível", "essencial"],
  ["auxiliar", "ajudar"], ["iniciar", "começar"], ["finalizar", "terminar"], ["concluir", "terminar"],
  ["verificar", "conferir"], ["comunicar", "avisar"], ["informar", "avisar"], ["demonstrar", "mostrar"],
  ["evidenciar", "mostrar"], ["proporcionar", "dar"], ["objetivar", "buscar"], ["otimizar", "melhorar"],
  ["priorizar", "focar em"], ["supracitado", "citado"], ["referido", "esse"], ["outrossim", "também"],
  ["concernente", "sobre"], ["relativamente", "sobre"], ["atualmente", "hoje"], ["frequentemente", "muitas vezes"],
  ["eventualmente", "às vezes"], ["integralmente", "todo"], ["imediatamente", "já"], ["previamente", "antes"],
  ["simultaneamente", "ao mesmo tempo"], ["adicionalmente", "além disso"], ["percentual", "porcentagem"],
  ["metodologia", "método"], ["funcionalidade", "recurso"], ["dificultar", "atrapalhar"], ["requisitar", "pedir"],
];

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export const SUBSTITUTIONS_PT: ReadonlyMap<string, string> = new Map(RAW.map(([from, to]) => [stripAccents(from), to]));
