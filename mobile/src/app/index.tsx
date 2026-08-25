import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Screen } from '../components';
import { useTheme } from '../theme';

/**
 * Tela inicial (placeholder). Nesta etapa só existe para provar que o
 * roteamento e o tema estão funcionando — sem lógica de negócio, sem
 * autenticação. Os links abaixo são apenas para navegar manualmente entre
 * os stacks durante o desenvolvimento desta fundação.
 */
export default function Home() {
  const { spacing } = useTheme();

  return (
    <Screen>
      <View style={styles.center}>
        <AppText variant="display">ALILU</AppText>
        <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
          Fundação do app — em construção
        </AppText>

        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Link href="/(auth)/login" asChild>
            <AppText color="secondary">→ Auth (placeholder)</AppText>
          </Link>
          <Link href="/(resident)" asChild>
            <AppText color="secondary">→ Resident (placeholder)</AppText>
          </Link>
          <Link href="/(professional)" asChild>
            <AppText color="secondary">→ Professional (placeholder)</AppText>
          </Link>
          <Link href="/(administration)" asChild>
            <AppText color="secondary">→ Administration (placeholder)</AppText>
          </Link>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
