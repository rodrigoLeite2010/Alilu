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
 * Atendimentos/reservas ainda não foram implementados ("Ainda NÃO criar
 * Booking" — PROMPT 07).
 */
export default function ProfessionalLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="availability/index" />
      <Stack.Screen name="availability/editor" />
      <Stack.Screen name="availability/blocked-dates" />
      <Stack.Screen name="availability/calendar" />
    </Stack>
  );
}
