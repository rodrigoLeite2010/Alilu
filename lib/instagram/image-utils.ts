/**
 * Utilidades de upload/validação de imagem do editor. O processamento é
 * 100% local: usamos `URL.createObjectURL`, sem jamais enviar o arquivo do
 * usuário para nenhum servidor (ETAPA 5.2 e 9). As URLs criadas devem ser
 * liberadas com `revokeImageObjectUrl` assim que deixarem de ser usadas
 * (troca ou remoção da imagem, ou desmontagem do componente) para não
 * vazar memória (ETAPA 5.2: "Liberar os recursos de memória utilizados por
 * arquivos temporários").
 */

export const MAX_IMAGE_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const ACCEPTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ACCEPTED_IMAGE_INPUT_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida o tipo e o tamanho de um arquivo de imagem enviado pelo usuário,
 * retornando uma mensagem amigável em português quando inválido (ETAPA
 * 5.2: "Exibir uma mensagem amigável caso o arquivo seja inválido ou muito
 * grande").
 */
export function validateImageFile(file: File): ImageValidationResult {
  if (!ACCEPTED_IMAGE_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Formato não suportado. Envie uma imagem JPG, PNG ou WEBP.",
    };
  }

  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: "Essa imagem é muito grande. Envie um arquivo de até 15 MB.",
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: "Não foi possível ler esse arquivo. Tente outra imagem.",
    };
  }

  return { valid: true };
}

export function createImageObjectUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function revokeImageObjectUrl(url: string | null | undefined): void {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ambiente sem suporte a URL.revokeObjectURL — nada a fazer.
  }
}

/** Carrega uma imagem a partir de uma URL (blob: ou data:) já em memória, para obter suas dimensões reais e poder desenhá-la no canvas. */
export function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a imagem enviada."));
    image.src = url;
  });
}
