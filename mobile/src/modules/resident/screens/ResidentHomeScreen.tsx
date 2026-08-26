import { router } from 'expo-router';
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
 *
 * Desde o PROMPT 08, também dá acesso a "meus agendamentos"
 * (MyBookingsScreen, módulo Scheduling) — o início do agendamento em si
 * ("Agendar") fica em ProfessionalProfileScreen, depois de escolher o
 * profissional. Desde o PROMPT 10, também dá acesso a "minhas
 * recomendações" (RecommendationsScreen, módulo Recommendations) — a
 * própria recomendação de um profissional específico ("Recomendar") fica
 * em ProfessionalProfileScreen, mesmo padrão de "Agendar".
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

        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <AppButton label="Buscar profissional" onPress={() => router.push('/(resident)/professional-categories')} />
          <AppButton label="Meus agendamentos" variant="secondary" onPress={() => router.push('/(resident)/bookings')} />
          <AppButton label="Minhas recomendações" variant="secondary" onPress={() => router.push('/(resident)/recommendations')} />
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <AppButton label="Sair" variant="ghost" onPress={() => logout()} />
        </View>
      </View>
    </Screen>
  );
}
