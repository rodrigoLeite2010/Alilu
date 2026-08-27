import { View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';

type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'accent';

interface BadgeProps {
  label: string;
  tone?: Tone;
}

/**
 * React Native: Badge (Etapa 20 — modernização visual "estilo iFood/apps
 * atuais"). Chip de status colorido para substituir os vários mapas de
 * rótulo em texto puro sem nenhum destaque visual espalhados pelo app —
 * `BOOKING_STATUS_LABEL` (scheduling), `RECOMMENDATION_STATUS_LABEL`
 * (recommendations), `NOTIFICATION_TYPE_LABEL` (notifications),
 * `STATUS_LABEL`/`TYPE_LABEL` locais (MyAgendaScreen/BlockedDatesScreen).
 *
 * Fundo levemente tingido + texto na cor cheia, calculado a partir das
 * MESMAS cores semânticas já existentes em `theme/colors.ts` (nenhuma cor
 * nova) — React Native aceita hex de 8 dígitos (`#RRGGBBAA`), então
 * `${cor}1F` dá um fundo com ~12% de opacidade sem precisar de um token de
 * cor separado para "fundo do badge".
 */
export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const { colors, spacing, radii, typography } = useTheme();

  const toneColor: Record<Tone, string> = {
    success: colors.semantic.success,
    warning: colors.semantic.warning,
    error: colors.semantic.error,
    info: colors.semantic.info,
    accent: colors.brand.accent,
    neutral: colors.text.secondary,
  };

  const color = toneColor[tone];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: `${color}1F`,
        borderRadius: radii.full,
        paddingHorizontal: spacing.xs,
        paddingVertical: spacing.xxs / 2,
      }}
    >
      <AppText style={{ color, fontSize: typography.size.xs, fontWeight: typography.weight.semibold }}>
        {label}
      </AppText>
    </View>
  );
}
