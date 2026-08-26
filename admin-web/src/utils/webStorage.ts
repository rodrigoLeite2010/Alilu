/**
 * Wrapper fino sobre `localStorage` — equivalente web de
 * `mobile/src/utils/secureStorage.ts` (que usa o Secure Store do
 * dispositivo). `localStorage` não isola por processo do jeito que o
 * Secure Store faz, mas é o padrão razoável para um SPA de browser — a
 * única chave usada aqui é o refresh token (ver `AuthProvider`), nunca o
 * access token (esse vive só em memória, perdido a cada reload — ver
 * `services/authTokenStore.ts`).
 *
 * Assinatura `async` (mesmo `localStorage` sendo síncrono) só para manter
 * a mesma interface do `secureStorage.ts` do mobile — quem chama não
 * precisa saber qual dos dois está por trás.
 */
export async function getWebItem(key: string): Promise<string | null> {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Navegação privada / storage bloqueado — sem sessão persistida, mas a
    // aplicação continua funcionando dentro desta mesma aba.
    return null;
  }
}

export async function setWebItem(key: string, value: string): Promise<void> {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ver comentário acima.
  }
}

export async function deleteWebItem(key: string): Promise<void> {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ver comentário acima.
  }
}
