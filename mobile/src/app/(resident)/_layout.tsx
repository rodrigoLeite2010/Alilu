import { Stack } from 'expo-router';

/**
 * ResidentStack — telas voltadas ao morador. Desde o PROMPT 05, o próprio
 * `index` decide (com base no vínculo do usuário — ver
 * `useMyMemberships`) se mostra a área do morador (ResidentHome) ou o
 * fluxo de validação (choose-condominium/enter-invitation-code/
 * request-access/waiting-approval — "acesso sem vínculo"). As demais
 * telas do morador (buscar profissional, agendamentos, avaliações) ainda
 * não foram implementadas.
 */
export default function ResidentLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="choose-condominium" />
      <Stack.Screen name="enter-invitation-code" />
      <Stack.Screen name="request-access" />
      <Stack.Screen name="waiting-approval" />
    </Stack>
  );
}
