import axios, { isAxiosError, type InternalAxiosRequestConfig } from 'axios';

import { getAccessToken, refreshAccessToken, triggerLogout } from './authTokenStore';

/**
 * Instância Axios compartilhada do admin-web — mesmo papel de
 * `mobile/src/services/api.ts`, adaptado para um SPA de browser (CORS: ver
 * `Program.cs`/`appsettings.json` do backend, seção "Cors:AdminWebOrigins").
 *
 * `VITE_API_URL` deve ser definida em um `.env` local (não versionado —
 * ver `.env.example`) quando a Api estiver disponível em outro host que
 * não `http://localhost:5205`.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5205',
  timeout: 15000,
});

// Anexa o access token (em memória, nunca persistido em texto puro — ver
// authTokenStore.ts) em toda chamada, quando existir.
api.interceptors.request.use((config) => {
  const accessToken = getAccessToken();

  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return config;
});

// Rotas de auth nunca devem entrar no fluxo de refresh automático abaixo —
// um 401 em /login ou /register é só "credenciais inválidas", e um 401 em
// /refresh já É a própria tentativa de renovação falhando.
const AUTH_ENDPOINTS_WITHOUT_AUTO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh'];

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retriedAfterRefresh?: boolean;
}

// Evita disparar múltiplas renovações em paralelo quando várias chamadas
// recebem 401 ao mesmo tempo — todas aguardam a mesma promise de refresh.
let ongoingRefresh: Promise<string | null> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!isAxiosError(error) || error.response?.status !== 401 || !error.config) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as RetryableRequestConfig;
    const isAuthEndpoint = AUTH_ENDPOINTS_WITHOUT_AUTO_REFRESH.some((path) =>
      originalRequest.url?.includes(path),
    );

    if (isAuthEndpoint || originalRequest._retriedAfterRefresh) {
      return Promise.reject(error);
    }

    originalRequest._retriedAfterRefresh = true;

    if (!ongoingRefresh) {
      ongoingRefresh = refreshAccessToken().finally(() => {
        ongoingRefresh = null;
      });
    }

    const newAccessToken = await ongoingRefresh;

    if (!newAccessToken) {
      await triggerLogout();
      return Promise.reject(error);
    }

    originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
    return api(originalRequest);
  },
);
