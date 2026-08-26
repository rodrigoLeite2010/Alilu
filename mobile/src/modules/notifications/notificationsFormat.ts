import type { NotificationType } from './types';

/**
 * Rótulos PT-BR por tipo — usado só como uma pequena etiqueta visual em
 * NotificationItem (o `title`/`message` já vêm prontos do backend; isto é
 * só um complemento de categoria, não repete a REGRA "não expor
 * informações sensíveis" porque não adiciona nenhuma informação nova).
 */
export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  BookingCreated: 'Agendamento',
  BookingAccepted: 'Agendamento',
  BookingRejected: 'Agendamento',
  BookingCancelled: 'Agendamento',
  ServiceReminder: 'Lembrete',
  ServiceCompleted: 'Serviço',
  NewReview: 'Avaliação',
  RecommendationApproved: 'Recomendação',
  AccessRequestApproved: 'Acesso',
  AccessRequestRejected: 'Acesso',
};

/** Mesmo formato "dd/mm/aaaa hh:mm" usado por outros módulos (ver `recommendationsFormat.ts#formatRecommendationDate`), com hora porque notificações costumam se acumular no mesmo dia. */
export function formatNotificationDate(isoDate: string): string {
  const date = new Date(isoDate);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}
