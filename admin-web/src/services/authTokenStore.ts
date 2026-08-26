/**
 * Estado de autenticação compartilhado entre `services/api.ts` (que não
 * sabe nada de React) e `modules/auth/AuthProvider.tsx` (que não deveria
 * conhecer detalhes do Axios) — mesmo papel de
 * `mobile/src/services/authTokenStore.ts`: os dois lados conversam sem um
 * importar o outro (evita ciclo de import).
 *
 * - `AuthProvider` registra, uma vez, como renovar o token
 *   (`registerRefreshHandler`) e como encerrar a sessão
 *   (`registerLogoutHandler`).
 * - Os interceptors do Axios (`services/api.ts`) usam `getAccessToken` para
 *   anexar o header `Authorization`, e chamam
 *   `refreshAccessToken`/`triggerLogout` quando uma resposta 401 chega.
 */
type RefreshHandler = () => Promise<string | null>;
type LogoutHandler = () => Promise<void>;

let accessToken: string | null = null;
let refreshHandler: RefreshHandler | null = null;
let logoutHandler: LogoutHandler | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function registerRefreshHandler(handler: RefreshHandler | null): void {
  refreshHandler = handler;
}

export function registerLogoutHandler(handler: LogoutHandler | null): void {
  logoutHandler = handler;
}

/** Chamado pelo interceptor de resposta do Axios quando uma chamada autenticada recebe 401. */
export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshHandler) {
    return null;
  }
  return refreshHandler();
}

/** Chamado quando a renovação falha — encerra a sessão local (equivalente a um logout forçado). */
export async function triggerLogout(): Promise<void> {
  if (logoutHandler) {
    await logoutHandler();
  }
}
