import { useLocalSearchParams } from 'expo-router';

import { DateSelectionScreen } from '../../../../modules/scheduling';

export default function BookingDate() {
  const { professionalId } = useLocalSearchParams<{ professionalId: string }>();
  return <DateSelectionScreen professionalId={professionalId} />;
}
