/**
 * Heurística conservadora para erros que costumam indicar App Review,
 * modo Development ou conta sem papel/autorização no app da Meta.
 * Não tenta contornar a Meta: só permite mostrar uma mensagem honesta.
 */

export function isLikelyMetaReviewError(input: {
  error?: string | null;
  errorCode?: string | number | null;
  errorType?: string | null;
  errorMessage?: string | null;
}): boolean {
  const joined = [input.error, input.errorCode, input.errorType, input.errorMessage]
    .filter((value): value is string | number => value !== null && value !== undefined)
    .join(" ")
    .toLowerCase();

  return [
    "insufficient developer role",
    "developer role",
    "app not active",
    "development mode",
    "app review",
    "review",
    "advanced access",
    "not approved",
    "not authorized",
    "permission denied",
    "permissions error",
  ].some((needle) => joined.includes(needle));
}
