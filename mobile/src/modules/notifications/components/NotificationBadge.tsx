import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '../../../components';
import { useTheme } from '../../../theme';
import { useUnreadNotificationCount } from '../hooks';

/**
 * React Native: NotificationBadge (PROMPT 11) — o sino com a contagem não
 * lida, usado em ResidentHomeScreen/ProfessionalEditScreen (topo da tela
 * inicial de cada papel, mesmo lugar de "Sair"). Tocar abre o
 * NotificationCenter (`/notifications`, rota de nível raiz — não fica
 * dentro de `(resident)`/`(professional)` porque o mesmo destino serve
 * qualquer papel autenticado, ver `app/notifications/index.tsx`).
 */
export function NotificationBadge() {
  const { colors, spacing, radii } = useTheme();
  const { data: unreadCount } = useUnreadNotificationCount();

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel="Notificações"
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}
    >
      <AppText variant="subtitle">🔔</AppText>
      {unreadCount ? (
        <View
          style={{
            backgroundColor: colors.semantic.error,
            borderRadius: radii.full,
            minWidth: 20,
            height: 20,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.xxs,
          }}
        >
          <AppText style={{ color: colors.text.inverse, fontSize: 12 }}>{unreadCount > 99 ? '99+' : unreadCount}</AppText>
        </View>
      ) : null}
    </Pressable>
  );
}
