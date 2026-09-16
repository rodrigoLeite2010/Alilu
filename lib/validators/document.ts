/**
 * Máscara e validação de CPF/CNPJ, no padrão brasileiro.
 *
 * Mantido isolado da interface (PROMPT MESTRE, seção 14). Implementa os
 * algoritmos reais de dígito verificador — não valida apenas a quantidade
 * de dígitos (ver PROMPT ETAPA 2, seção 4).
 */

export type DocumentType = "cpf" | "cnpj";

/** Remove tudo que não for dígito. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Aplica a máscara de CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00) a
 * um valor, detectando qual das duas pela quantidade de dígitos já digitados
 * (até 11 dígitos -> CPF; 12 a 14 -> CNPJ). Funciona tanto para digitação
 * progressiva quanto para colar o número já completo, com ou sem pontuação.
 */
export function formatCpfCnpjMask(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 11) {
    const p1 = digits.slice(0, 3);
    const p2 = digits.slice(3, 6);
    const p3 = digits.slice(6, 9);
    const p4 = digits.slice(9, 11);

    let out = p1;
    if (p2) out += `.${p2}`;
    if (p3) out += `.${p3}`;
    if (p4) out += `-${p4}`;
    return out;
  }

  const p1 = digits.slice(0, 2);
  const p2 = digits.slice(2, 5);
  const p3 = digits.slice(5, 8);
  const p4 = digits.slice(8, 12);
  const p5 = digits.slice(12, 14);

  let out = p1;
  if (p2) out += `.${p2}`;
  if (p3) out += `.${p3}`;
  if (p4) out += `/${p4}`;
  if (p5) out += `-${p5}`;
  return out;
}

/** Retorna true quando todos os dígitos são iguais (ex.: 000.000.000-00). */
function isAllSameDigit(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

/** Valida um CPF pelo algoritmo real dos dois dígitos verificadores. */
export function isValidCPF(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || isAllSameDigit(digits)) {
    return false;
  }

  const nums = digits.split("").map(Number);

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += nums[i] * (10 - i);
  }
  let firstCheck = (sum * 10) % 11;
  if (firstCheck === 10) firstCheck = 0;
  if (firstCheck !== nums[9]) {
    return false;
  }

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += nums[i] * (11 - i);
  }
  let secondCheck = (sum * 10) % 11;
  if (secondCheck === 10) secondCheck = 0;

  return secondCheck === nums[10];
}

/** Valida um CNPJ pelo algoritmo real dos dois dígitos verificadores. */
export function isValidCNPJ(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || isAllSameDigit(digits)) {
    return false;
  }

  const nums = digits.split("").map(Number);

  const calcCheckDigit = (base: number[]): number => {
    const weights =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.reduce(
      (acc, digit, index) => acc + digit * weights[index],
      0
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstCheck = calcCheckDigit(nums.slice(0, 12));
  if (firstCheck !== nums[12]) {
    return false;
  }

  const secondCheck = calcCheckDigit(nums.slice(0, 13));
  return secondCheck === nums[13];
}

/**
 * Detecta o tipo de documento (CPF ou CNPJ) pela quantidade de dígitos.
 * Retorna null quando a quantidade de dígitos não corresponde a nenhum dos
 * dois (documento incompleto).
 */
export function documentTypeLabel(value: string): "CPF" | "CNPJ" | null {
  const digits = onlyDigits(value);
  if (digits.length === 11) return "CPF";
  if (digits.length === 14) return "CNPJ";
  return null;
}

export interface DocumentValidation {
  valid: boolean;
  type: DocumentType | null;
}

/**
 * Valida um campo de CPF/CNPJ opcional: uma string vazia é válida (o campo é
 * opcional), mas, quando preenchida, precisa corresponder a um CPF ou CNPJ
 * matematicamente válido — não apenas ter a quantidade certa de dígitos.
 */
export function validateOptionalCpfCnpj(value: string): DocumentValidation {
  const digits = onlyDigits(value);

  if (digits.length === 0) {
    return { valid: true, type: null };
  }
  if (digits.length === 11) {
    return { valid: isValidCPF(digits), type: "cpf" };
  }
  if (digits.length === 14) {
    return { valid: isValidCNPJ(digits), type: "cnpj" };
  }
  return { valid: false, type: null };
}
