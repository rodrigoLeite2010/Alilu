import { useLocalSearchParams } from 'expo-router';

import { BookingDetailsScreen } from '../../../modules/scheduling';

export default function ProfessionalBookingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BookingDetailsScreen bookingId={id} role="professional" />;
}
