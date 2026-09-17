/**
 * Conversão segura de texto simples para HTML — ferramenta "Texto para
 * HTML" (categoria Funções String). Escapa entidades HTML antes de
 * qualquer outra transformação, para nunca produzir HTML executável a
 * partir do texto do usuário (proteção contra XSS). Tudo acontece
 * localmente; o HTML produzido nunca é executado por esta ferramenta, só
 * exibido como texto para o usuário copiar.
 */

export type TextToHtmlMode = "br" | "p";

export interface TextToHtmlOptions {
  /** "br": quebra de linha -> <br>. "p": bloco separado por linha em branco -> <p>. */
  mode: TextToHtmlMode;
  /** Converte sequências de espaços extras em &nbsp; para preservar o espaçamento visual. */
  preserveSpaces: boolean;
}

export const DEFAULT_TEXT_TO_HTML_OPTIONS: TextToHtmlOptions = {
  mode: "br",
  preserveSpaces: false,
};

/** Escapa os 5 caracteres HTML especiais — nunca deve ser pulado. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function textToHtml(text: string, options: TextToHtmlOptions): string {
  let escaped = escapeHtml(text);

  if (options.preserveSpaces) {
    escaped = escaped.replace(/ {2,}/g, (run) => "&nbsp;".repeat(run.length - 1) + " ");
  }

  if (options.mode === "br") {
    return escaped.split(/\r\n|\r|\n/).join("<br>\n");
  }

  return escaped
    .split(/\n\s*\n/)
    .filter((block) => block.trim().length > 0)
    .map((block) => `<p>${block.split(/\r\n|\r|\n/).join("<br>\n")}</p>`)
    .join("\n");
}
