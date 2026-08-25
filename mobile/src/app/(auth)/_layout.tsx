import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../modules/auth';

/**
 * AuthStack — fluxo de autenticação (login, cadastro, recuperação de
 * senha). Quem já está autenticado é redirecionado para fora daqui — não
 * faz sentido mostrar a tela de login para quem já tem sessão ativa.
 */
export default function AuthLayout() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
