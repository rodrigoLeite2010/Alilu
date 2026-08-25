import * as Notifications from 'expo-notifications';

/**
 * Ponto único de integração com Expo Notifications.
 *
 * Nesta etapa apenas a arquitetura está preparada (handler de
 * apresentação padrão + função para solicitar permissão). Registro de
 * push token e tratamento de notificações de negócio (ex.: lembrete de
 * agendamento) ficam para quando o módulo Notifications for implementado.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') {
    return true;
  }
  const { status: requested } = await Notifications.requestPermissionsAsync();
  return requested === 'granted';
}
