import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppText, Screen } from '../components';
import { EditableAvatar, useAuth } from '../modules/auth';
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
          <View style={{ alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
            <EditableAvatar name={user.name} />
            <AppText variant="subtitle" color="secondary" style={{ textAlign: 'center' }}>
              Olá, {user.name}
            </AppText>
          </View>
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
            <AppText color="secondary">→ Área do morador</AppText>
          </Link>
          <Link href="/(professional)" asChild>
            <AppText color="secondary">→ Área do prestador</AppText>
          </Link>
          <Link href="/(administration)" asChild>
            <AppText color="secondary">→ Administração (em breve)</AppText>
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
