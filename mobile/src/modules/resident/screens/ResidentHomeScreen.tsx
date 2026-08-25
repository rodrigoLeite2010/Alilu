import { View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useAuth } from '../../auth';
import { useTheme } from '../../../theme';
import { useCondominiums, useCondominiumUnits } from '../hooks';
import type { Membership } from '../types';

interface ResidentHomeScreenProps {
  membership: Membership;
}

/**
 * Área do morador (PROMPT 05) — só é alcançada com um vínculo Active (ver
 * gate em `(resident)/index.tsx`). Condomínio/unidade são resolvidos aqui
 * só para exibição, consultando o diretório público (módulo Condominium)
 * pelo mesmo Id já validado no vínculo — nenhuma tela deste app confia em
 * nada que não tenha vindo do próprio backend.
 */
export function ResidentHomeScreen({ membership }: ResidentHomeScreenProps) {
  const { spacing } = useTheme();
  const { user, logout } = useAuth();
  const { data: condominiums } = useCondominiums();
  const { data: units } = useCondominiumUnits(membership.condominiumId);

  const condominium = condominiums?.find((item) => item.id === membership.condominiumId);
  const unit = units?.find((item) => item.id === membership.unitId);

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <AppText variant="title">Olá, {user?.name}</AppText>

        <View style={{ marginTop: spacing.md, gap: spacing.xxs }}>
          <AppText variant="subtitle" color="secondary">
            {condominium?.name ?? 'Seu condomínio'}
          </AppText>
          <AppText variant="body" color="muted">
            {unit ? `Unidade ${unit.code}` : 'Unidade vinculada'}
          </AppText>
        </View>

        <AppText variant="body" color="secondary" style={{ marginTop: spacing.lg }}>
          ResidentStack — demais telas (buscar profissional, agendamentos, avaliações) ainda não implementadas.
        </AppText>

        <View style={{ marginTop: spacing.xl }}>
          <AppButton label="Sair" variant="ghost" onPress={() => logout()} />
        </View>
      </View>
    </Screen>
  );
}
