import { Stack } from 'expo-router';

/**
 * ResidentStack — telas voltadas ao morador (buscar profissional, meus
 * agendamentos, avaliações, perfil). Nenhuma tela real implementada
 * ainda, apenas a rota inicial placeholder.
 */
export default function ResidentLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
