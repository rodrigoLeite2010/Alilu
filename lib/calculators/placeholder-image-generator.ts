/**
 * Geração de imagens de placeholder (retângulos com dimensão e cor
 * escolhidas pelo usuário, com o texto de tamanho desenhado no centro)
 * para preencher protótipos e layouts (categoria Geradores). Mantido
 * isolado da interface (PROMPT MESTRE, seção 14).
 *
 * Este arquivo contém só a validação e o cálculo de rótulo — o desenho em
 * si usa a Canvas API do navegador (elemento <canvas>), disponível apenas
 * no componente (components/tools/placeholder-image-generator), porque
 * não existe no ambiente de testes (jsdom não implementa
 * CanvasRenderingContext2D). Nenhuma imagem gerada é enviada a servidor
 * algum — o download acontece inteiramente no navegador da pessoa.
 */

export const PLACEHOLDER_IMAGE_MIN_SIZE = 16;
export const PLACEHOLDER_IMAGE_MAX_SIZE = 2000;

export interface PlaceholderImageInput {
  width: number;
  height: number;
  backgroundColor: string;
  textColor: string;
  label: string;
}

export interface PlaceholderImageFieldErrors {
  width?: string;
  height?: string;
  backgroundColor?: string;
  textColor?: string;
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

function validateSize(value: number): boolean {
  return (
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= PLACEHOLDER_IMAGE_MIN_SIZE &&
    value <= PLACEHOLDER_IMAGE_MAX_SIZE
  );
}

export function validatePlaceholderImageInput(input: PlaceholderImageInput): PlaceholderImageFieldErrors {
  const errors: PlaceholderImageFieldErrors = {};

  if (!validateSize(input.width)) {
    errors.width = `A largura deve ser um número inteiro entre ${PLACEHOLDER_IMAGE_MIN_SIZE} e ${PLACEHOLDER_IMAGE_MAX_SIZE}.`;
  }
  if (!validateSize(input.height)) {
    errors.height = `A altura deve ser um número inteiro entre ${PLACEHOLDER_IMAGE_MIN_SIZE} e ${PLACEHOLDER_IMAGE_MAX_SIZE}.`;
  }
  if (!isValidHexColor(input.backgroundColor)) {
    errors.backgroundColor = "Informe uma cor hexadecimal válida (ex.: #CBD5E1).";
  }
  if (!isValidHexColor(input.textColor)) {
    errors.textColor = "Informe uma cor hexadecimal válida (ex.: #1E293B).";
  }

  return errors;
}

export function isPlaceholderImageInputValid(input: PlaceholderImageInput): boolean {
  return Object.keys(validatePlaceholderImageInput(input)).length === 0;
}

/** Rótulo padrão desenhado no centro da imagem, quando nenhum texto é informado. */
export function buildPlaceholderLabel(width: number, height: number, label: string): string {
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : `${width} × ${height}`;
}

/** Nome de arquivo sugerido para o download da imagem gerada. */
export function buildPlaceholderFileName(width: number, height: number): string {
  return `placeholder-${width}x${height}.png`;
}
