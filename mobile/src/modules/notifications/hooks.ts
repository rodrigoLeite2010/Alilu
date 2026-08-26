import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationApi } from './api';
import type { RegisterDeviceTokenPayload } from './types';

const MY_NOTIFICATIONS_QUERY_KEY = ['notifications', 'mine'];
const UNREAD_COUNT_QUERY_KEY = ['notifications', 'unread-count'];

/** React Native: NotificationCenter. */
export function useMyNotifications() {
  return useQuery({
    queryKey: MY_NOTIFICATIONS_QUERY_KEY,
    queryFn: () => notificationApi.listMine(),
  });
}

/**
 * React Native: NotificationBadge. `refetchInterval` mantém o número
 * exibido no sino razoavelmente atual mesmo sem o morador/profissional
 * abrir o NotificationCenter — não é um requisito literal do prompt, só
 * uma decisão de UX (o badge de um sino que nunca atualiza sozinho não
 * cumpriria bem o próprio propósito de existir).
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: UNREAD_COUNT_QUERY_KEY,
    queryFn: () => notificationApi.getUnreadCount(),
    refetchInterval: 30000,
  });
}

/** React Native: NotificationItem — "ao clicar na notificação" marca como lida antes de abrir a tela correspondente. */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_NOTIFICATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
    },
  });
}

/** React Native: NotificationCenter — "marcar todas como lidas". */
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_NOTIFICATIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
    },
  });
}

/** Chamado por `services/notifications.ts` assim que o Expo devolve/renova o push token do dispositivo. */
export function useRegisterDeviceToken() {
  return useMutation({
    mutationFn: (payload: RegisterDeviceTokenPayload) => notificationApi.registerDeviceToken(payload),
  });
}

/** Logout — para de receber push neste dispositivo. */
export function useRemoveDeviceToken() {
  return useMutation({
    mutationFn: () => notificationApi.removeDeviceToken(),
  });
}
