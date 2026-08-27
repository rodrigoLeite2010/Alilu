import { api } from '../../services/api';
import type { AuthTokens, AuthUser, LoginPayload, RegisterPayload } from './types';

const BASE_PATH = '/api/auth';

/**
 * Chamadas HTTP cruas do módulo de autenticação. `AuthProvider` é quem
 * orquestra estado (tokens, usuário atual) em cima destas funções — este
 * arquivo não conhece React nem SecureStore.
 */
export const authApi = {
  register(payload: RegisterPayload) {
    return api.post<AuthUser>(`${BASE_PATH}/register`, payload).then((response) => response.data);
  },

  login(payload: LoginPayload) {
    return api.post<AuthTokens>(`${BASE_PATH}/login`, payload).then((response) => response.data);
  },

  refresh(refreshToken: string) {
    return api
      .post<AuthTokens>(`${BASE_PATH}/refresh`, { refreshToken })
      .then((response) => response.data);
  },

  revoke(refreshToken: string) {
    return api.post<void>(`${BASE_PATH}/revoke`, { refreshToken }).then((response) => response.data);
  },

  me() {
    return api.get<AuthUser>(`${BASE_PATH}/me`).then((response) => response.data);
  },

  /**
   * Etapa 21 — `base64Image` já deve vir recortada/comprimida pelo próprio
   * celular (ver `components/EditableAvatar`, que usa `expo-image-picker`
   * com `allowsEditing`); esta função só faz o upload, não sabe nada de
   * câmera/galeria/permissões.
   */
  setPhoto(base64Image: string, contentType: string) {
    return api.put<AuthUser>(`${BASE_PATH}/me/photo`, { base64Image, contentType }).then((response) => response.data);
  },

  removePhoto() {
    return api.delete<AuthUser>(`${BASE_PATH}/me/photo`).then((response) => response.data);
  },
};
