import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../modules/auth';

/**
 * AdministrationStack — telas de administração do condomínio (gestão de
 * moradores/profissionais, visão operacional). Nenhuma tela real
 * implementada ainda, apenas a rota inicial placeholder.
 *
 * Guarda de autenticação (mesmo bug/correção de `(professional)/_layout.tsx`
 * — ver comentário lá): sem sessão válida, redireciona para o login em vez
 * de deixar as telas montarem e só descobrir 401 chamada por chamada.
 */
export default function AdministrationLayout() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
