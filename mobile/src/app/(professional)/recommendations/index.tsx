import { ActivityIndicator, View } from 'react-native';

import { useMyProfessionalProfile } from '../../../modules/professional';
import { ProfessionalRecommendationsScreen } from '../../../modules/recommendations';
import { useTheme } from '../../../theme';

/**
 * Composição raiz do PROMPT 10: resolve o próprio perfil profissional
 * (módulo Professional) para descobrir o `professionalId` a passar para
 * ProfessionalRecommendationsScreen — mesmo espírito de
 * `(professional)/index.tsx` (o gate do módulo).
 */
export default function OwnProfessionalRecommendations() {
  const { colors } = useTheme();
  const { data: profile, isLoading } = useMyProfessionalProfile();

  if (isLoading || !profile) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.brand.primary} />
      </View>
    );
  }

  return <ProfessionalRecommendationsScreen professionalId={profile.id} />;
}
