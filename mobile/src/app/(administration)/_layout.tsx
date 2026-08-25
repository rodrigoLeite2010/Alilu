import { Stack } from 'expo-router';

/**
 * AdministrationStack — telas de administração do condomínio (gestão de
 * moradores/profissionais, visão operacional). Nenhuma tela real
 * implementada ainda, apenas a rota inicial placeholder.
 */
export default function AdministrationLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
