import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppText, Screen } from '../components';
import { useAuth } from '../modules/auth';
import { useTheme } from '../theme';

/**
 * Tela inicial. Sem autenticação implementada nesta etapa não havia nada a
 * mostrar aqui além de links de navegação; agora que existe, ela reflete a
 * sessão real — ainda sem nenhum vínculo com condomínio (isso é do módulo
 * Resident, futuro), só a prova de que login/logout funcionam de ponta a
 * ponta.
 */
export default function Home() {
  const { spacing } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <Screen>
      <View style={styles.center}>
        <AppText variant="display">ALILU</AppText>

        {isAuthenticated && user ? (
          <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs, textAlign: 'center' }}>
            Olá, {user.name}
          </AppText>
        ) : (
          <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
            Fundação do app — em construção
          </AppText>
        )}

        <View style={{ marginTop: spacing.xl, gap: spacing.sm, width: '100%' }}>
          {isAuthenticated ? (
            <AppButton label="Sair" variant="ghost" onPress={() => logout()} />
          ) : (
            <Link href="/(auth)/login" asChild>
              <AppButton label="Entrar" />
            </Link>
          )}

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
