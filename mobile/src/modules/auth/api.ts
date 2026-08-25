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
};
