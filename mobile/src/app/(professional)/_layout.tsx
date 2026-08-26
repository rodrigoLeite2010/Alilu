import { Stack } from 'expo-router';

/**
 * ProfessionalStack — telas voltadas ao profissional. Desde o PROMPT 06, o
 * próprio `index` decide (com base em `useMyProfessionalProfile`) se
 * mostra o formulário de criação de perfil ou o próprio perfil (edição +
 * serviços + condomínios) — mesmo padrão de `(resident)/index.tsx`
 * (PROMPT 05).
 *
 * Desde o PROMPT 07, `availability/*` reúne as quatro telas de
 * disponibilidade (AvailabilityScreen/AvailabilityEditor/
 * BlockedDatesScreen/CalendarAvailabilityScreen), acessíveis a partir de
 * "Configurar disponibilidade" em ProfessionalEditScreen.
 *
 * Desde o PROMPT 08 ("o módulo mais crítico"), `requests/*` reúne o fluxo
 * "receber solicitação → aceitar ou recusar" (ProfessionalRequestsScreen/
 * BookingDetailsScreen, módulo Scheduling), acessível a partir de
 * "Solicitações" em ProfessionalEditScreen.
 *
 * Desde o PROMPT 09, `reviews/index` (ProfessionalReviewsScreen, módulo
 * Reviews — "visualizar avaliações recebidas; visualizar média") é
 * acessível a partir de "Avaliações" em ProfessionalEditScreen.
 */
export default function ProfessionalLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="availability/index" />
      <Stack.Screen name="availability/editor" />
      <Stack.Screen name="availability/blocked-dates" />
      <Stack.Screen name="availability/calendar" />
      <Stack.Screen name="requests/index" />
      <Stack.Screen name="requests/[id]" />
      <Stack.Screen name="reviews/index" />
    </Stack>
  );
}
