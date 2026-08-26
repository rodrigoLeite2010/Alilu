import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

import type { NotificationType } from '../modules/notifications/types';

/**
 * Ponto único de integração com Expo Notifications (PROMPT 11 completa o
 * que a etapa anterior deixou preparado: "Configurar device token" e o
 * tratamento de toque em notificação — ver `modules/notifications`).
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

/**
 * Obtém o Expo push token do dispositivo, para registrar no backend
 * (`POST /api/notifications/device-token`).
 *
 * `getExpoPushTokenAsync` exige um `projectId` de um projeto EAS
 * configurado — este repositório ainda não tem um (`app.json` não define
 * `extra.eas.projectId`, nem existe `eas.json`). Isso é uma pendência de
 * configuração do projeto (rodar `eas init`/`eas build:configure`), não um
 * defeito de código: por isso a função retorna `null` de forma
 * silenciosa quando o projectId não está disponível, em vez de lançar —
 * o app continua funcionando normalmente (só sem push remoto até essa
 * configuração ser feita; notificações internas via NotificationCenter
 * continuam funcionando independente disso).
 */
export async function getExpoPushToken(): Promise<string | null> {
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    return null;
  }

  try {
    const granted = await requestNotificationPermission();
    if (!granted) {
      return null;
    }
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    // Best-effort — falha ao obter o token não pode travar o app (mesmo
    // espírito de IPushNotificationSender.SendAsync no backend: nunca
    // propagar uma falha de push para a ação de negócio).
    return null;
  }
}

/** Payload que a Api embute no campo `data` do push do Expo (ver `ExpoPushNotificationSender`). */
export interface NotificationPushData {
  type?: NotificationType;
  referenceId?: string;
}

/**
 * Registra o listener de toque em notificação — cobre tanto o toque numa
 * notificação em primeiro plano/lista interna quanto, principalmente, o
 * toque numa notificação do sistema (app em segundo plano/fechado), que é
 * o caso em que só o `data` do push (não uma tela React já aberta) informa
 * para onde navegar ("ao clicar na notificação, abrir a tela
 * correspondente" — REGRA do PROMPT 11).
 *
 * Retorna a função de `remove()` da subscription, para uso em cleanup de
 * efeito (`useEffect`).
 */
export function addNotificationResponseListener(
  onResponse: (data: NotificationPushData) => void,
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = (response.notification.request.content.data ?? {}) as NotificationPushData;
    onResponse(data);
  });
  return () => subscription.remove();
}
