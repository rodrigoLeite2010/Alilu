import { Pressable, View } from 'react-native';

import { AppText, Badge } from '../../../components';
import { useTheme } from '../../../theme';
import { formatNotificationDate, NOTIFICATION_TYPE_LABEL } from '../notificationsFormat';
import type { Notification } from '../types';

interface NotificationItemProps {
  notification: Notification;
  onPress: () => void;
}

/**
 * React Native: NotificationItem (PROMPT 11) — uma linha do
 * NotificationCenter. `title`/`message` já vêm prontos do backend (nunca
 * dado sensível — ver nota em `types.ts`); o único estado visual próprio
 * daqui é lida/não lida (ponto de destaque + peso da fonte).
 */
export function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const { colors, spacing, radii, shadows } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        notification.isRead ? undefined : shadows.sm,
        {
          flexDirection: 'row',
          gap: spacing.xs,
          padding: spacing.sm,
          borderRadius: radii.lg,
          backgroundColor: notification.isRead ? colors.surfaceAlt : colors.surface,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: radii.full,
          backgroundColor: notification.isRead ? 'transparent' : colors.brand.accent,
          marginTop: spacing.xxs,
        }}
      />

      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Badge label={NOTIFICATION_TYPE_LABEL[notification.type]} tone="neutral" />
        <AppText style={{ fontWeight: notification.isRead ? 'normal' : 'bold' }}>{notification.title}</AppText>
        <AppText color="secondary">{notification.message}</AppText>
        <AppText variant="caption" color="muted">
          {formatNotificationDate(notification.createdAt)}
        </AppText>
      </View>
    </Pressable>
  );
}
