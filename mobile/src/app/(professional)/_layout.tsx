import { Stack } from 'expo-router';

/**
 * ProfessionalStack — telas voltadas ao profissional (agenda,
 * disponibilidade, atendimentos). Nenhuma tela real implementada ainda,
 * apenas a rota inicial placeholder.
 */
export default function ProfessionalLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
