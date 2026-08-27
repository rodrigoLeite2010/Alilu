import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

import type { NotificationType } from '../modules/notifications/types';

/**
 * Ponto único de integração com Expo Notifications (PROMPT 11 completa o
 * que a etapa anterior deixou preparado: "Configurar device token" e o
 * tratamento de toque em notificação — ver `modules/notifications`).
 *
 * IMPORTANTE (achado ao testar via Expo Go, Etapa 21): a partir do SDK 53,
 * o próprio `import * as Notifications from 'expo-notifications'` já é
 * suficiente para derrubar o app no Android dentro do Expo Go — o pacote
 * registra um listener de push token como efeito colateral do import
 * (`DevicePushTokenAutoRegistration.fx.js`), que lança `Error`
 * incondicionalmente nesse cenário (não dá pra evitar só não chamando as
 * funções de push — o `throw` acontece ao carregar o módulo). Só um
 * "development build" (não é o app final do usuário, é uma build de
 * desenvolvimento — ver link abaixo) evita isso, e essa etapa do projeto
 * não trata disso agora.
 *
 * Por isso o import do pacote aqui é DINÂMICO e só é feito fora desse
 * cenário bloqueado; `isRunningInExpoGo()` (do pacote `expo`, sem esse
 * problema) detecta o cenário sem precisar tocar em `expo-notifications`.
 * Todas as funções deste arquivo viram no-op silencioso quando bloqueadas —
 * mesmo espírito de "getExpoPushToken sem projectId configurado", já
 * documentado abaixo: push remoto fica indisponível, mas o resto do app
 * (inclusive notificações internas via NotificationCenter) continua normal.
 * https://docs.expo.dev/develop/development-builds/introduction/
 */
const isPushBlockedInExpoGo = Platform.OS === 'android' && isRunningInExpoGo();

type NotificationsModule = typeof import('expo-notifications');

let notificationsModulePromise: Promise<NotificationsModule> | null = null;

function loadNotifications(): Promise<NotificationsModule> | null {
  if (isPushBlockedInExpoGo) {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications').then((module) => {
      module.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      return module;
    });
  }

  return notificationsModulePromise;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await loadNotifications();
  if (!Notifications) {
    return false;
  }

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
    const Notifications = await loadNotifications();
    if (!Notifications) {
      return null;
    }
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
 * Retorna a função de cleanup, para uso direto como retorno de efeito
 * (`useEffect`) — por isso precisa ser SÍNCRONA mesmo com o import do
 * módulo sendo assíncrono (ver `loadNotifications` acima): a inscrição de
 * fato só acontece quando a Promise resolve, mas a função de cleanup já
 * existe desde já e cobre tanto "desmontou antes de resolver" (via
 * `cancelled`) quanto "desmontou depois" (via `subscription?.remove()`).
 * Bloqueado (Expo Go + Android): não inscreve nada, cleanup é um no-op.
 */
export function addNotificationResponseListener(
  onResponse: (data: NotificationPushData) => void,
): () => void {
  const modulePromise = loadNotifications();
  if (!modulePromise) {
    return () => {};
  }

  let subscription: { remove: () => void } | null = null;
  let cancelled = false;

  modulePromise.then((Notifications) => {
    if (cancelled) {
      return;
    }
    subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = (response.notification.request.content.data ?? {}) as NotificationPushData;
      onResponse(data);
    });
  });

  return () => {
    cancelled = true;
    subscription?.remove();
  };
}
