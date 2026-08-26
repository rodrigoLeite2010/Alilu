import type { UserRole } from '../auth';
import type { NotificationType } from './types';

/** Um `router.push` já resolvido — mesmo formato usado em todo o app (ex.: `ProfessionalRequestsScreen`) para rotas com parâmetro dinâmico. */
export interface NotificationRoute {
  pathname: string;
  params?: Record<string, string>;
}

/**
 * Só o mínimo que `resolveNotificationRoute` precisa — um `Notification`
 * completo (toque na lista do NotificationCenter) satisfaz isso, mas
 * também o payload `data` de um push do Expo (toque numa notificação do
 * sistema, sem ter buscado a lista — ver `services/notifications.ts#
 * addNotificationResponseListener`), que só carrega `type`/`referenceId`.
 */
export interface NotificationRouteInput {
  type: NotificationType;
  referenceId: string | null;
}

/**
 * REGRA "ao clicar na notificação, abrir a tela correspondente" (PROMPT
 * 11). Só depende de `NotificationType` (deste módulo) e `UserRole`
 * (módulo Auth — tratado como fundação compartilhada, mesma convenção já
 * usada em `ResidentHomeScreen`/`ProfessionalEditScreen` importando
 * `useAuth`), nunca dos módulos de negócio (Scheduling/Reviews/
 * Recommendations/Resident) — só o literal da rota, sem nenhum dado
 * daqueles módulos.
 *
 * Alguns tipos (Booking* / ServiceReminder) podem ter sido enviados tanto
 * para um morador quanto para um profissional (ver ARCHITECTURE.md,
 * "Etapa 11 — composição") — por isso dependem do papel do usuário
 * autenticado para escolher entre a tela do morador ou a do profissional.
 * Devolve `null` quando não há `referenceId` ou o tipo não tem uma tela
 * própria para abrir (nenhum caso real hoje, mas evita navegar para uma
 * rota inválida se um tipo novo for adicionado no futuro sem atualizar
 * este mapeamento).
 */
export function resolveNotificationRoute(notification: NotificationRouteInput, role: UserRole): NotificationRoute | null {
  switch (notification.type) {
    case 'BookingCreated':
      // Este tipo só é enviado ao profissional (ver BookingsController.Create, backend).
      return notification.referenceId
        ? { pathname: '/(professional)/requests/[id]', params: { id: notification.referenceId } }
        : null;

    case 'BookingAccepted':
    case 'BookingRejected':
    case 'BookingCancelled':
    case 'ServiceCompleted':
    case 'ServiceReminder':
      if (!notification.referenceId) {
        return null;
      }
      return role === 'Professional'
        ? { pathname: '/(professional)/requests/[id]', params: { id: notification.referenceId } }
        : { pathname: '/(resident)/bookings/[id]', params: { id: notification.referenceId } };

    case 'NewReview':
      // Só enviada ao profissional; não há tela de detalhe por avaliação
      // (ver ProfessionalReviewsScreen, Etapa 09) — abre a lista.
      return { pathname: '/(professional)/reviews' };

    case 'RecommendationApproved':
      // Só enviada a quem recomendou (sempre um morador).
      return notification.referenceId
        ? { pathname: '/(resident)/recommendations/[id]', params: { id: notification.referenceId } }
        : null;

    case 'AccessRequestApproved':
    case 'AccessRequestRejected':
      // O gate em (resident)/index.tsx já resolve sozinho qual tela mostrar
      // a partir do status de vínculo atual — não precisa de um Id.
      return { pathname: '/(resident)' };

    default:
      return null;
  }
}
