import { api } from '../../services/api';
import type { Notification, RegisterDeviceTokenPayload } from './types';

const NOTIFICATIONS_BASE_PATH = '/api/notifications';

/**
 * Chamadas HTTP cruas (PROMPT 11). Espelha `modules/recommendations/api.ts`:
 * este arquivo não conhece React nem o estado do app — quem orquestra isso
 * é `hooks.ts` (TanStack Query).
 */
export const notificationApi = {
  /** React Native: NotificationCenter. */
  listMine() {
    return api.get<Notification[]>(NOTIFICATIONS_BASE_PATH).then((response) => response.data);
  },

  /** React Native: NotificationBadge. */
  getUnreadCount() {
    return api.get<number>(`${NOTIFICATIONS_BASE_PATH}/unread-count`).then((response) => response.data);
  },

  /** React Native: NotificationItem — "ao clicar na notificação". */
  markAsRead(id: string) {
    return api.post<Notification>(`${NOTIFICATIONS_BASE_PATH}/${id}/read`).then((response) => response.data);
  },

  /** React Native: NotificationCenter — "marcar todas como lidas". */
  markAllAsRead() {
    return api.post<void>(`${NOTIFICATIONS_BASE_PATH}/read-all`).then(() => undefined);
  },

  /** React Native: "Configurar device token" — chamado logo após o app obter/renovar o Expo push token (ver `services/notifications.ts`). */
  registerDeviceToken(payload: RegisterDeviceTokenPayload) {
    return api.post<void>(`${NOTIFICATIONS_BASE_PATH}/device-token`, payload).then(() => undefined);
  },

  /** Logout — para de receber push neste dispositivo. */
  removeDeviceToken() {
    return api.delete<void>(`${NOTIFICATIONS_BASE_PATH}/device-token`).then(() => undefined);
  },
};
