import { api } from '../../services/api';
import type { AuthTokens, LoginPayload } from './types';

const BASE_PATH = '/api/auth';

/**
 * Chamadas HTTP cruas do módulo de autenticação — mesmo papel de
 * `mobile/src/modules/auth/api.ts`. `AuthProvider` é quem orquestra estado
 * (tokens, usuário atual) em cima destas funções.
 *
 * Sem `register` aqui de propósito: o admin-web não cadastra usuários — um
 * CondominiumAdmin/SuperAdmin precisa já existir (criado via seed, banco,
 * ou o fluxo de registro do app mobile) antes de logar aqui.
 */
export const authApi = {
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
};
