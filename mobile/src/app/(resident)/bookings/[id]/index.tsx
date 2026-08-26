import { router, useLocalSearchParams } from 'expo-router';

import { AppButton } from '../../../../components';
import { useMyReviewForBooking } from '../../../../modules/reviews';
import { BookingDetailsScreen } from '../../../../modules/scheduling';

/**
 * Composição raiz do PROMPT 09 para o botão "Avaliar"/"Ver avaliação": o
 * módulo Scheduling não pode importar o módulo Reviews (independência de
 * módulos), então é aqui — a camada de rotas, mesmo papel de
 * `ReviewsController` no backend — que se resolve se já existe uma
 * avaliação para este agendamento (`useMyReviewForBooking`) antes de
 * passar o botão certo para o slot `reviewSlot` de `BookingDetailsScreen`.
 */
export default function ResidentBookingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: existingReview } = useMyReviewForBooking(id);

  return (
    <BookingDetailsScreen
      bookingId={id}
      role="resident"
      reviewSlot={() => (
        <AppButton
          label={existingReview ? 'Ver avaliação' : 'Avaliar profissional'}
          variant="secondary"
          onPress={() => router.push(`/(resident)/bookings/${id}/review`)}
        />
      )}
    />
  );
}
