/**
 * Validação e preparação de conteúdo para o Gerador de QR Code, isolada da
 * interface (PROMPT MESTRE, seção 14). A geração do QR Code em si (desenho
 * da imagem) é feita pela biblioteca `qrcode` diretamente no componente
 * client-side — este arquivo cobre apenas a parte testável e sem DOM: qual
 * texto será codificado e a validação de URL.
 *
 * PROMPT MESTRE ("QR Code"): "Validar URLs quando modo URL for utilizado."
 * e "Não criar um redirecionador" — o conteúdo codificado é sempre o texto
 * literal informado pelo usuário, nunca um link intermediário do Alilu.
 */

export type QrCodeMode = "url" | "text";

export interface QrCodeInput {
  mode: QrCodeMode;
  value: string;
}

export interface QrCodeFieldErrors {
  value?: string;
}

/**
 * Valida uma URL de forma prática: aceita URLs com esquema explícito
 * (http/https) e também endereços "sem esquema" digitados como as pessoas
 * costumam digitar (ex.: "alilu.com.br"), que passam a ser tratados como
 * "https://alilu.com.br". Rejeita apenas o que claramente não é um endereço
 * web (sem nenhum ponto, ou com espaços).
 */
export function isLikelyValidUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "" || /\s/.test(trimmed)) {
    return false;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    return url.hostname.includes(".") && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/** Normaliza uma URL sem esquema para "https://...", mantendo o esquema se já houver um. */
export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function validateQrCodeInput(input: QrCodeInput): QrCodeFieldErrors {
  const errors: QrCodeFieldErrors = {};
  const trimmed = input.value.trim();

  if (trimmed === "") {
    errors.value =
      input.mode === "url"
        ? "Informe um link para gerar o QR Code."
        : "Informe um texto para gerar o QR Code.";
    return errors;
  }

  if (input.mode === "url" && !isLikelyValidUrl(trimmed)) {
    errors.value = "Informe uma URL válida, ex.: https://alilu.com.br";
  }

  return errors;
}

export function isQrCodeInputValid(input: QrCodeInput): boolean {
  return Object.keys(validateQrCodeInput(input)).length === 0;
}

/** Retorna o conteúdo exato que deve ser codificado no QR Code. */
export function buildQrCodeContent(input: QrCodeInput): string {
  const trimmed = input.value.trim();
  return input.mode === "url" ? normalizeUrl(trimmed) : trimmed;
}
