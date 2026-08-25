import { ActivityIndicator, View } from 'react-native';

import { ProfessionalEditScreen, useMyProfessionalProfile } from '../../modules/professional';
import { useTheme } from '../../theme';

/**
 * Gate do módulo Professional (PROMPT 06): sem perfil ainda → formulário
 * de criação; com perfil → o próprio perfil (edição + serviços +
 * condomínios) — mesmo espírito do gate em `(resident)/index.tsx`
 * (PROMPT 05). ProfessionalEditScreen decide sozinho o que mostrar a
 * partir de `profile` ser `null` ou não.
 */
export default function ProfessionalIndex() {
  const { colors } = useTheme();
  const { data: profile, isLoading } = useMyProfessionalProfile();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.brand.primary} />
      </View>
    );
  }

  return <ProfessionalEditScreen profile={profile ?? null} />;
}
