import { Stack } from 'expo-router';

/**
 * AuthStack — fluxo de autenticação (login, cadastro, recuperação de
 * senha). Nesta etapa contém apenas a tela placeholder de login; o login
 * em si (chamada à API, validação, guarda de rota) não foi implementado.
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
