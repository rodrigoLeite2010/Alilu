import { useLocalSearchParams } from 'expo-router';

import { ReviewScreen } from '../../../../modules/reviews';
import { useBookingProfessionalsDirectory, useMyBooking } from '../../../../modules/scheduling';

/**
 * Composição raiz do PROMPT 09: o módulo Reviews não conhece o diretório
 * de profissionais (módulo Professional) nem o próprio agendamento (módulo
 * Scheduling) — é aqui, na camada de rotas, que o nome do profissional é
 * resolvido (mesmo diretório já usado por `BookingDetailsScreen`) e
 * repassado como prop pronta para `ReviewScreen`.
 */
export default function ResidentBookingReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: booking } = useMyBooking(id);
  const { data: professionals } = useBookingProfessionalsDirectory();

  const professionalName = professionals?.find((professional) => professional.id === booking?.professionalId)?.displayName;

  return <ReviewScreen bookingId={id} professionalName={professionalName} />;
}
