import { router } from 'expo-router';
import { View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import type { BookingMembershipSummary, BookingProfessionalSummary } from '../types';

interface ProfessionalBookingScreenProps {
  professionalId: string;
  /** Resolvido pela camada de rotas (`app/(resident)/booking/[professionalId]/index.tsx`) a partir do diretório público do módulo Professional — `null` enquanto carrega ou se o perfil não existir mais. */
  professional: BookingProfessionalSummary | null;
  /** Resolvido pela camada de rotas a partir do vínculo Active do morador (módulo Resident) — `null` quando o morador não tem (mais) um vínculo Active. */
  membership: BookingMembershipSummary | null;
}

/**
 * React Native: ProfessionalBookingScreen (PROMPT 08) — primeiro passo do
 * fluxo do morador ("escolher profissional"), alcançado a partir do botão
 * "Agendar" em ProfessionalProfileScreen. Confirma o profissional
 * escolhido e o vínculo (condomínio/unidade) que será usado no
 * agendamento — o morador nunca escolhe condomínio/unidade manualmente
 * aqui: "morador só pode agendar para a própria Unit" (REGRA CRÍTICA) é
 * garantido usando sempre o vínculo Active do próprio usuário, resolvido
 * pela Api antes desta tela ainda existir a possibilidade de escolha
 * errada (o servidor revalida de qualquer forma em `POST .../bookings`).
 */
export function ProfessionalBookingScreen({ professionalId, professional, membership }: ProfessionalBookingScreenProps) {
  const { spacing, colors } = useTheme();

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.lg }}>
        <View>
          <AppText variant="title">Agendar atendimento</AppText>
          <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
            {professional ? professional.displayName : 'Carregando profissional…'}
          </AppText>
        </View>

        {professional && professional.categories.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs }}>
            {professional.categories.map((category) => (
              <AppText key={category.id} variant="caption" color="secondary">
                {category.name}
              </AppText>
            ))}
          </View>
        ) : null}

        {!membership ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>
              Você precisa de um vínculo ativo com um condomínio para agendar um atendimento.
            </AppText>
          </View>
        ) : (
          <AppText variant="body" color="secondary">
            O agendamento será feito para a sua unidade vinculada.
          </AppText>
        )}

        <View style={{ gap: spacing.sm, marginTop: 'auto' }}>
          <AppButton
            label="Continuar"
            onPress={() => router.push({ pathname: '/(resident)/booking/[professionalId]/date', params: { professionalId } })}
            disabled={!professional || !membership}
          />
          <AppButton label="Voltar" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}
