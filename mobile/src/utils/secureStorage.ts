import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Wrapper fino sobre o Expo Secure Store, com fallback para `localStorage`
 * no Web (mesmo raciocínio de `admin-web/src/utils/webStorage.ts`, que já
 * existia como "equivalente web do Secure Store do mobile" — só que para o
 * próprio SPA do admin-web, não para este app rodando via `expo start
 * --web`). `expo-secure-store` não tem implementação real na Web (seu
 * binding nativo vira um objeto vazio nesse ambiente — ver
 * `node_modules/expo-secure-store/src/ExpoSecureStore.web.ts`), então
 * chamar `SecureStore.setItemAsync`/`getItemAsync`/`deleteItemAsync`
 * diretamente ali lançaria "ExpoSecureStore.setValueWithKeyAsync is not a
 * function" — sem isto, login/registro nunca conseguiriam persistir a
 * sessão ao testar pelo navegador. `localStorage` não isola por processo
 * do jeito que o Secure Store faz, mas é o padrão razoável para testar
 * localmente no navegador (nunca é usado em Android/iOS, onde o Secure
 * Store de verdade continua sendo usado).
 */
const isWeb = Platform.OS === 'web';

export async function getSecureItem(key: string): Promise<string | null> {
  if (isWeb) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      // Navegação privada / storage bloqueado — sem sessão persistida, mas
      // a aplicação continua funcionando dentro desta mesma aba.
      return null;
    }
  }

  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ver comentário acima.
    }
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (isWeb) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ver comentário acima.
    }
    return;
  }

  await SecureStore.deleteItemAsync(key);
}
