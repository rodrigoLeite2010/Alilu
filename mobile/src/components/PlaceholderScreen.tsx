import { View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import { Screen } from './Screen';

interface PlaceholderScreenProps {
  title: string;
  subtitle?: string;
}

/**
 * Tela placeholder usada pelos stacks desta etapa (Auth/Resident/
 * Professional/Administration) enquanto as telas reais não são
 * implementadas. Não contém nenhuma lógica de negócio.
 */
export function PlaceholderScreen({ title, subtitle }: PlaceholderScreenProps) {
  const { spacing } = useTheme();

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <AppText variant="title">{title}</AppText>
        <AppText
          variant="body"
          color="muted"
          style={{ marginTop: spacing.xxs, textAlign: 'center' }}
        >
          {subtitle ?? 'Tela ainda não implementada.'}
        </AppText>
      </View>
    </Screen>
  );
}
