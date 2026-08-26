import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { registerLogoutHandler, registerRefreshHandler, setAccessToken } from '../../services/authTokenStore';
import { deleteWebItem, getWebItem, setWebItem } from '../../utils/webStorage';
import { authApi } from './api';
import { isAdminRole, type AuthTokens, type AuthUser, type LoginPayload } from './types';

const REFRESH_TOKEN_KEY = 'alilu.admin.refreshToken';

/** Lançado por `login` quando as credenciais são válidas mas o usuário não é CondominiumAdmin/SuperAdmin (PROMPT 12 — "AUTORIZAÇÃO"). */
export class NotAnAdminError extends Error {
  constructor() {
    super('Este usuário não tem acesso ao painel administrativo.');
    this.name = 'NotAnAdminError';
  }
}

interface AuthContextValue {
  /** `null` enquanto não autenticado. */
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** `true` só durante a checagem inicial de sessão (página acabou de carregar). */
  isBootstrapping: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Dono do estado de autenticação do admin-web: usuário atual, access token
 * (só em memória — ver `authTokenStore`) e refresh token (`localStorage` —
 * ver `webStorage`, equivalente web do Secure Store do mobile). Mesmo
 * papel de `mobile/src/modules/auth/AuthProvider.tsx`; a diferença central
 * é a checagem de papel logo após o login — só CondominiumAdmin/SuperAdmin
 * podem usar este painel (ver `NotAnAdminError`). Essa checagem é só UX: a
 * autorização de verdade é sempre no backend (`[Authorize(Roles = ...)]`
 * em cada controller administrativo).
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const applySession = useCallback(async (tokens: AuthTokens) => {
    setAccessToken(tokens.accessToken);
    await setWebItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    setUser(tokens.user);
  }, []);

  const clearSession = useCallback(async () => {
    setAccessToken(null);
    await deleteWebItem(REFRESH_TOKEN_KEY);
    setUser(null);
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const tokens = await authApi.login(payload);

      if (!isAdminRole(tokens.user.role)) {
        // Credenciais corretas, mas não é um administrador — não guarda
        // sessão nenhuma e revoga o par de tokens recém-emitido (best
        // effort: se a chamada falhar, o token só fica órfão até expirar).
        try {
          await authApi.revoke(tokens.refreshToken);
        } catch {
          // Ver comentário acima.
        }
        throw new NotAnAdminError();
      }

      await applySession(tokens);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    const storedRefreshToken = await getWebItem(REFRESH_TOKEN_KEY);

    if (storedRefreshToken) {
      try {
        await authApi.revoke(storedRefreshToken);
      } catch {
        // Best-effort: se o servidor estiver inacessível, a sessão local é
        // encerrada de qualquer forma.
      }
    }

    await clearSession();
  }, [clearSession]);

  // Chamado pelo interceptor de resposta do Axios quando uma chamada
  // autenticada recebe 401 — tenta renovar a sessão de forma transparente
  // para quem fez a chamada original.
  const handleAutoRefresh = useCallback(async (): Promise<string | null> => {
    const storedRefreshToken = await getWebItem(REFRESH_TOKEN_KEY);

    if (!storedRefreshToken) {
      return null;
    }

    try {
      const tokens = await authApi.refresh(storedRefreshToken);

      if (!isAdminRole(tokens.user.role)) {
        // Não deveria acontecer (o papel de um usuário não muda sozinho
        // entre um login e o próximo refresh), mas se acontecer, mesma
        // reação de `login`: nenhuma sessão de admin-web para quem não é
        // administrador.
        await clearSession();
        return null;
      }

      await applySession(tokens);
      return tokens.accessToken;
    } catch {
      await clearSession();
      return null;
    }
  }, [applySession, clearSession]);

  useEffect(() => {
    registerRefreshHandler(handleAutoRefresh);
    registerLogoutHandler(clearSession);

    return () => {
      registerRefreshHandler(null);
      registerLogoutHandler(null);
    };
  }, [handleAutoRefresh, clearSession]);

  // Bootstrap: ao carregar a página, tenta restaurar a sessão a partir do
  // refresh token salvo no localStorage (o access token nunca é
  // persistido — vive só em memória e é perdido a cada reload, de
  // propósito).
  useEffect(() => {
    async function bootstrap() {
      const storedRefreshToken = await getWebItem(REFRESH_TOKEN_KEY);

      if (!storedRefreshToken) {
        setIsBootstrapping(false);
        return;
      }

      try {
        const tokens = await authApi.refresh(storedRefreshToken);

        if (!isAdminRole(tokens.user.role)) {
          await clearSession();
          return;
        }

        await applySession(tokens);
      } catch {
        await clearSession();
      } finally {
        setIsBootstrapping(false);
      }
    }

    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda uma única vez, na montagem (bootstrap de sessão)
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isBootstrapping,
      login,
      logout,
    }),
    [user, isBootstrapping, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de um <AuthProvider>.');
  }

  return context;
}
