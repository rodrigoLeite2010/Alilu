import { Pressable, View } from 'react-native';

import { AppText } from '../../../components';
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
  const { colors, spacing, radii } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        gap: spacing.xs,
        padding: spacing.sm,
        borderRadius: radii.md,
        backgroundColor: notification.isRead ? colors.surface : colors.surfaceAlt,
      }}
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
        <AppText variant="caption" color="secondary">
          {NOTIFICATION_TYPE_LABEL[notification.type]}
        </AppText>
        <AppText style={{ fontWeight: notification.isRead ? 'normal' : 'bold' }}>{notification.title}</AppText>
        <AppText color="secondary">{notification.message}</AppText>
        <AppText variant="caption" color="muted">
          {formatNotificationDate(notification.createdAt)}
        </AppText>
      </View>
    </Pressable>
  );
}
