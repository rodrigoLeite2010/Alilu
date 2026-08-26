/**
 * Espelha `Alilu.Modules.Notifications.Application/Dtos.cs` e
 * `Domain/NotificationType.cs` (PROMPT 11). A Api serializa enums como
 * string e usa camelCase — mesma observação já registrada em
 * `modules/auth/types.ts` (PROMPT 03).
 *
 * Os dez valores, na mesma ordem do prompt (EVENTOS).
 */
export type NotificationType =
  | 'BookingCreated'
  | 'BookingAccepted'
  | 'BookingRejected'
  | 'BookingCancelled'
  | 'ServiceReminder'
  | 'ServiceCompleted'
  | 'NewReview'
  | 'RecommendationApproved'
  | 'AccessRequestApproved'
  | 'AccessRequestRejected';

/**
 * Campos exatamente como o backend devolve — `title`/`message` já chegam
 * prontos para exibição (o backend nunca inclui dado sensível de outro
 * módulo neles, ver ARCHITECTURE.md, "Etapa 11" — REGRA "não expor
 * informações sensíveis na notificação"). `referenceId` aponta para a
 * entidade de origem (Booking/Review/Recommendation/Membership, conforme
 * `type`) — usado só para navegar para a tela correspondente ao tocar na
 * notificação (ver `resolveNotificationRoute` em `notificationRouting.ts`),
 * nunca para buscar mais detalhes daquela entidade aqui.
 */
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  referenceId: string | null;
  readAt: string | null;
  createdAt: string;
  isRead: boolean;
}

/** Corpo de `POST /api/notifications/device-token` — React Native: "Configurar device token" (Expo push token do dispositivo atual). */
export interface RegisterDeviceTokenPayload {
  token: string;
}
