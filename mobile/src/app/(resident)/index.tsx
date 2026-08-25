import { ActivityIndicator, View } from 'react-native';

import { ChooseCondominiumScreen, ResidentHomeScreen, useMyMemberships, WaitingApprovalScreen } from '../../modules/resident';
import { useTheme } from '../../theme';

/**
 * Gate de validação do morador (PROMPT 05): "usuário autenticado sem
 * vínculo Active → mostrar fluxo de validação; com vínculo Active → área
 * do morador". Decide entre três telas a partir de `useMyMemberships`:
 *
 * - existe vínculo Active → ResidentHomeScreen;
 * - não existe Active, mas existe Pending → WaitingApprovalScreen;
 * - nenhum vínculo (nem Active, nem Pending) → ChooseCondominiumScreen,
 *   o início do fluxo de validação (convite ou solicitação).
 *
 * Rejected/Blocked não dão acesso — nesse caso o usuário também cai no
 * início do fluxo (pode tentar de novo, ex.: um novo convite, ou uma
 * nova solicitação depois de uma rejeição — ver PROMPT 05).
 */
export default function ResidentIndex() {
  const { colors } = useTheme();
  const { data: memberships, isLoading } = useMyMemberships();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.brand.primary} />
      </View>
    );
  }

  const activeMembership = memberships?.find((membership) => membership.status === 'Active');
  if (activeMembership) {
    return <ResidentHomeScreen membership={activeMembership} />;
  }

  const pendingMembership = memberships?.find((membership) => membership.status === 'Pending');
  if (pendingMembership) {
    return <WaitingApprovalScreen />;
  }

  return <ChooseCondominiumScreen />;
}
