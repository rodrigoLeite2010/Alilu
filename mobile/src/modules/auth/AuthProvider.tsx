import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { registerLogoutHandler, registerRefreshHandler, setAccessToken } from '../../services/authTokenStore';
import { deleteSecureItem, getSecureItem, setSecureItem } from '../../utils/secureStorage';
import { authApi } from './api';
import type { AuthTokens, AuthUser, LoginPayload, RegisterPayload } from './types';

const REFRESH_TOKEN_KEY = 'alilu.refreshToken';

interface AuthContextValue {
  /** `null` enquanto não autenticado — este usuário ainda não tem, necessariamente, vínculo com um condomínio (ver PROMPT 03). */
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** `true` só durante a checagem inicial de sessão (app acabou de abrir). */
  isBootstrapping: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  /**
   * Etapa 21 — atualiza só `photoUrl` no usuário em memória, chamado depois
   * de `authApi.setPhoto`/`authApi.removePhoto` já terem persistido no
   * servidor (ver `components/EditableAvatar`). Não existe um `updateUser`
   * genérico de propósito — nenhuma outra tela edita o próprio `AuthUser`
   * hoje (nome/e-mail/telefone não têm tela de edição própria ainda).
   */
  updateUserPhoto: (photoUrl: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Dono do estado de autenticação da aplicação: usuário atual, access token
 * (mantido só em memória, via `authTokenStore`) e refresh token (mantido
 * no Expo Secure Store — nunca em `AsyncStorage`/texto puro). Também se
 * registra em `authTokenStore` para que o interceptor do Axios
 * (`services/api.ts`) consiga renovar a sessão ou fazer logout sem
 * importar este arquivo diretamente (evita ciclo de import).
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const applySession = useCallback(async (tokens: AuthTokens) => {
    setAccessToken(tokens.accessToken);
    await setSecureItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    setUser(tokens.user);
  }, []);

  const clearSession = useCallback(async () => {
    setAccessToken(null);
    await deleteSecureItem(REFRESH_TOKEN_KEY);
    setUser(null);
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const tokens = await authApi.login(payload);
      await applySession(tokens);
    },
    [applySession],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      // RegisterAsync não retorna tokens (só os dados públicos do usuário —
      // ver Application/Dtos.cs), então login é feito logo em seguida para
      // já entrar autenticado após o cadastro.
      await authApi.register(payload);
      await login({ email: payload.email, password: payload.password });
    },
    [login],
  );

  const logout = useCallback(async () => {
    const storedRefreshToken = await getSecureItem(REFRESH_TOKEN_KEY);

    if (storedRefreshToken) {
      try {
        await authApi.revoke(storedRefreshToken);
      } catch {
        // Best-effort: se o servidor estiver inacessível, a sessão local é
        // encerrada de qualquer forma — o token só ficará órfão no banco
        // até expirar sozinho.
      }
    }

    await clearSession();
  }, [clearSession]);

  const updateUserPhoto = useCallback((photoUrl: string | null) => {
    setUser((current) => (current ? { ...current, photoUrl } : current));
  }, []);

  // Chamado pelo interceptor de resposta do Axios quando uma chamada
  // autenticada recebe 401 — tenta renovar a sessão de forma transparente
  // para quem fez a chamada original.
  const handleAutoRefresh = useCallback(async (): Promise<string | null> => {
    const storedRefreshToken = await getSecureItem(REFRESH_TOKEN_KEY);

    if (!storedRefreshToken) {
      return null;
    }

    try {
      const tokens = await authApi.refresh(storedRefreshToken);
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

  // Bootstrap: ao abrir o app, tenta restaurar a sessão a partir do refresh
  // token salvo no Secure Store (o access token nunca é persistido — vive
  // só em memória e é perdido a cada abertura do app, de propósito).
  useEffect(() => {
    async function bootstrap() {
      const storedRefreshToken = await getSecureItem(REFRESH_TOKEN_KEY);

      if (!storedRefreshToken) {
        setIsBootstrapping(false);
        return;
      }

      try {
        const tokens = await authApi.refresh(storedRefreshToken);
        await applySession(tokens);
      } catch {
        await clearSession();
      } finally {
        setIsBootstrapping(false);
      }
    }

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda uma única vez, na montagem (bootstrap de sessão)
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isBootstrapping,
      login,
      register,
      logout,
      updateUserPhoto,
    }),
    [user, isBootstrapping, login, register, logout, updateUserPhoto],
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
