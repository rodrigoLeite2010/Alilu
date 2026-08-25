import * as SecureStore from 'expo-secure-store';

/**
 * Wrapper fino sobre o Expo Secure Store — nenhuma chave de negócio (ex.:
 * token de auth) é definida aqui ainda. O módulo Identity irá decidir as
 * chaves reais (ex.: "alilu.accessToken") quando o login for implementado.
 */
export async function getSecureItem(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
