import { isAxiosError } from 'axios';

/**
 * O middleware de exceções da Api (ver backend
 * `src/Api/Alilu.Api/Middleware/ExceptionHandlingMiddleware.cs`) responde
 * erros como `{ status, title }`. Esta função extrai uma mensagem
 * amigável para exibir na tela, com um fallback genérico para qualquer
 * outro tipo de erro (rede indisponível, timeout, etc.).
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = 'Algo deu errado. Tente novamente.',
): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { title?: string } | undefined;
    return data?.title ?? fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
