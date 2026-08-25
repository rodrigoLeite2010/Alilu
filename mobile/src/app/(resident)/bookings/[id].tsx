import { useLocalSearchParams } from 'expo-router';

import { BookingDetailsScreen } from '../../../modules/scheduling';

export default function ResidentBookingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BookingDetailsScreen bookingId={id} role="resident" />;
}
