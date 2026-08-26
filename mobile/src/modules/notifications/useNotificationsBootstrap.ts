import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { addNotificationResponseListener, getExpoPushToken } from '../../services/notifications';
import { useAuth } from '../auth';
import { useRegisterDeviceToken, useRemoveDeviceToken } from './hooks';
import { resolveNotificationRoute } from './notificationRouting';

/**
 * Bootstrap de Notifications para o app inteiro — chamado uma vez em
 * `app/_layout.tsx` (`RootNavigator`), nunca dentro de uma tela específica,
 * porque cobre dois comportamentos que não pertencem a nenhum papel:
 *
 * 1. "Configurar device token" (REGRA/React Native do PROMPT 11): assim que
 *    há uma sessão autenticada, obtém o Expo push token (`getExpoPushToken`
 *    — devolve `null` sem lançar se o projeto EAS ainda não estiver
 *    configurado, ver `services/notifications.ts`) e registra no backend.
 *    Ao deixar de estar autenticado (logout), remove o token — para este
 *    dispositivo não continuar recebendo push de uma conta da qual saiu.
 *
 * 2. "Ao clicar na notificação, abrir a tela correspondente" para o caso de
 *    toque numa notificação do SISTEMA (app em segundo plano/fechado): o
 *    listener só tem o payload `data` (type/referenceId), não a lista de
 *    notificações — por isso usa `resolveNotificationRoute` com esse
 *    formato mínimo (`NotificationRouteInput`), com o papel do usuário
 *    autenticado.
 */
export function useNotificationsBootstrap() {
  const { user, isAuthenticated } = useAuth();
  const registerDeviceToken = useRegisterDeviceToken();
  const removeDeviceToken = useRemoveDeviceToken();
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      if (wasAuthenticated.current) {
        removeDeviceToken.mutate();
      }
      wasAuthenticated.current = false;
      return;
    }

    wasAuthenticated.current = true;
    let cancelled = false;

    getExpoPushToken().then((token) => {
      if (token && !cancelled) {
        registerDeviceToken.mutate({ token });
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (!user) {
      return;
    }

    return addNotificationResponseListener((data) => {
      if (!data.type) {
        return;
      }
      const route = resolveNotificationRoute({ type: data.type, referenceId: data.referenceId ?? null }, user.role);
      if (route) {
        router.push(route);
      }
    });
  }, [user]);
}
