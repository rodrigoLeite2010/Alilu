import { useLocalSearchParams } from 'expo-router';

import { ProfessionalRecommendationsScreen } from '../../../../modules/recommendations';

export default function ProfessionalRecommendations() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProfessionalRecommendationsScreen professionalId={id} />;
}
