import { ActivityIndicator, View } from 'react-native';

import { NotificationBadge } from '../../modules/notifications';
import { ProfessionalEditScreen, useMyProfessionalProfile } from '../../modules/professional';
import { useTheme } from '../../theme';

/**
 * Gate do módulo Professional (PROMPT 06): sem perfil ainda → formulário
 * de criação; com perfil → o próprio perfil (edição + serviços +
 * condomínios) — mesmo espírito do gate em `(resident)/index.tsx`
 * (PROMPT 05). ProfessionalEditScreen decide sozinho o que mostrar a
 * partir de `profile` ser `null` ou não.
 *
 * Desde o PROMPT 11, também compõe o NotificationBadge no `headerSlot` de
 * ProfessionalEditScreen — mesmo padrão de composição na camada de rotas
 * já usado em `(resident)/bookings/[id]/index.tsx` para o módulo Reviews.
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

  return <ProfessionalEditScreen profile={profile ?? null} headerSlot={() => <NotificationBadge />} />;
}
