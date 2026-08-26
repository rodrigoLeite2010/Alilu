import { Stack } from 'expo-router';

/**
 * ResidentStack — telas voltadas ao morador. Desde o PROMPT 05, o próprio
 * `index` decide (com base no vínculo do usuário — ver
 * `useMyMemberships`) se mostra a área do morador (ResidentHome) ou o
 * fluxo de validação (choose-condominium/enter-invitation-code/
 * request-access/waiting-approval — "acesso sem vínculo"). Desde o PROMPT
 * 06, ResidentHomeScreen também dá acesso a "buscar profissional"
 * (professional-categories/professionals/professionals/[id], módulo
 * Professional).
 *
 * Desde o PROMPT 08, `booking/[professionalId]/*` reúne o fluxo de
 * agendamento em 5 passos (ProfessionalBookingScreen/DateSelectionScreen/
 * TimeSelectionScreen/BookingServicesScreen/BookingConfirmationScreen —
 * módulo Scheduling), acessível a partir de "Agendar" em
 * ProfessionalProfileScreen; `bookings/*` reúne "meus agendamentos"
 * (MyBookingsScreen/BookingDetailsScreen), acessível a partir de "Meus
 * agendamentos" em ResidentHomeScreen.
 *
 * Desde o PROMPT 09, `bookings/[id]/*` virou uma rota aninhada (era um
 * arquivo só, `bookings/[id].tsx`) para caber `bookings/[id]/review`
 * (ReviewScreen, módulo Reviews — "avaliar profissional"/"editar
 * avaliação") ao lado de `bookings/[id]/index` (BookingDetailsScreen) —
 * mesmo padrão de `booking/[professionalId]/*` (Etapa 08) e
 * `availability/*` (Etapa 07). Acessível a partir do botão "Avaliar"/"Ver
 * avaliação" que `bookings/[id]/index.tsx` injeta no slot `reviewSlot` de
 * BookingDetailsScreen, só quando o agendamento está Completed.
 */
export default function ResidentLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="choose-condominium" />
      <Stack.Screen name="enter-invitation-code" />
      <Stack.Screen name="request-access" />
      <Stack.Screen name="waiting-approval" />
      <Stack.Screen name="professional-categories" />
      <Stack.Screen name="professionals" />
      <Stack.Screen name="professionals/[id]" />
      <Stack.Screen name="booking/[professionalId]/index" />
      <Stack.Screen name="booking/[professionalId]/date" />
      <Stack.Screen name="booking/[professionalId]/time" />
      <Stack.Screen name="booking/[professionalId]/services" />
      <Stack.Screen name="booking/[professionalId]/confirm" />
      <Stack.Screen name="bookings/index" />
      <Stack.Screen name="bookings/[id]/index" />
      <Stack.Screen name="bookings/[id]/review" />
    </Stack>
  );
}
