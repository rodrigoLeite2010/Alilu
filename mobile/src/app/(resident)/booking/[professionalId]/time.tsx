import { useLocalSearchParams } from 'expo-router';

import { TimeSelectionScreen } from '../../../../modules/scheduling';

export default function BookingTime() {
  const { professionalId, date } = useLocalSearchParams<{ professionalId: string; date: string }>();
  return <TimeSelectionScreen professionalId={professionalId} date={date} />;
}
