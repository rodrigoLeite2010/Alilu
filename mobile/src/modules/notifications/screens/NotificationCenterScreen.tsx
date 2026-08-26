import { router } from 'expo-router';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useAuth } from '../../auth';
import { useTheme } from '../../../theme';
import { NotificationItem } from '../components/NotificationItem';
import { useMarkAllNotificationsAsRead, useMarkNotificationAsRead, useMyNotifications } from '../hooks';
import { resolveNotificationRoute } from '../notificationRouting';
import type { Notification } from '../types';

/**
 * React Native: NotificationCenter (PROMPT 11) — "minhas notificações",
 * qualquer papel autenticado. Roteada em nível raiz (`app/notifications/
 * index.tsx`), não dentro de `(resident)`/`(professional)`, porque o mesmo
 * destino serve os dois papéis (e, no futuro, administração) — acessível a
 * partir de NotificationBadge em ResidentHomeScreen/ProfessionalEditScreen.
 *
 * "Ao clicar na notificação, abrir a tela correspondente" (REGRA do
 * prompt): marca como lida e navega via `resolveNotificationRoute`, que
 * decide o destino a partir do tipo + papel do usuário autenticado (alguns
 * tipos, como um lembrete de serviço, podem ter ido tanto para um morador
 * quanto para um profissional).
 */
export function NotificationCenterScreen() {
  const { spacing, colors } = useTheme();
  const { user } = useAuth();
  const { data: notifications, isLoading, isError, refetch } = useMyNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  async function onPressNotification(notification: Notification) {
    if (!notification.isRead) {
      await markAsRead.mutateAsync(notification.id).catch(() => undefined);
    }

    if (!user) {
      return;
    }

    const route = resolveNotificationRoute(notification, user.role);
    if (route) {
      router.push(route);
    }
  }

  const hasUnread = (notifications ?? []).some((notification) => !notification.isRead);

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.md }}>
        <AppText variant="title">Notificações</AppText>

        {hasUnread ? (
          <AppButton
            label={markAllAsRead.isPending ? 'Marcando…' : 'Marcar todas como lidas'}
            variant="secondary"
            onPress={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending}
          />
        ) : null}

        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} style={{ marginTop: spacing.md }} />
        ) : isError ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar suas notificações.</AppText>
            <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: spacing.xs }}
            renderItem={({ item }) => <NotificationItem notification={item} onPress={() => onPressNotification(item)} />}
            ListEmptyComponent={<AppText color="muted">Você ainda não recebeu nenhuma notificação.</AppText>}
          />
        )}

        <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
