import { router } from 'expo-router';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { AppButton, AppText, Badge, Card, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { useMyProfessionalInvitations } from '../hooks';
import type { ProfessionalInvitation } from '../types';

/** "2026-08-24T10:30:00Z" → "24/08/2026" — mesma função duplicada em outros módulos (não se importam entre si). */
function formatInvitationDate(createdAt: string): string {
  const datePart = createdAt.slice(0, 10);
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
}

/** Um badge por canal tentado — omite e-mail quando não foi informado (`emailDelivered === null`). */
function DeliveryBadges({ invitation }: { invitation: ProfessionalInvitation }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      <Badge label={invitation.whatsAppDelivered ? 'WhatsApp enviado' : 'WhatsApp não entregue'} tone={invitation.whatsAppDelivered ? 'success' : 'error'} />
      <Badge label={invitation.smsDelivered ? 'SMS enviado' : 'SMS não entregue'} tone={invitation.smsDelivered ? 'success' : 'error'} />
      {invitation.emailDelivered !== null ? (
        <Badge label={invitation.emailDelivered ? 'E-mail enviado' : 'E-mail não entregue'} tone={invitation.emailDelivered ? 'success' : 'error'} />
      ) : null}
    </View>
  );
}

/**
 * React Native: tela "Convidar prestador" (Etapa 23, pedido 1 de Rodrigo)
 * — histórico dos convites já enviados, com o resultado de entrega por
 * canal. Acessível a partir de "Convidar prestador" em ResidentHomeScreen
 * (módulo Resident), mesmo padrão de "Minhas recomendações"/"Mural".
 */
export function ProfessionalInvitationsScreen() {
  const { spacing, colors } = useTheme();
  const { data: invitations, isLoading, isError, refetch } = useMyProfessionalInvitations();

  return (
    <Screen>
      <View style={{ flex: 1, gap: spacing.md }}>
        <AppText variant="title">Convidar prestador</AppText>
        <AppText variant="subtitle" color="secondary">
          Indique um prestador que ainda não está no ALILU — ele recebe um convite por WhatsApp/SMS e e-mail.
        </AppText>

        <AppButton label="Novo convite" onPress={() => router.push('/(resident)/professional-invitations/new')} />

        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} style={{ marginTop: spacing.md }} />
        ) : isError ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar seus convites.</AppText>
            <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <FlatList
            data={invitations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: spacing.sm }}
            renderItem={({ item }) => (
              <Card style={{ gap: spacing.xxs }}>
                <AppText variant="subtitle">{item.name}</AppText>
                <AppText variant="body" color="secondary">
                  {item.phone}
                  {item.email ? ` · ${item.email}` : ''}
                </AppText>
                <DeliveryBadges invitation={item} />
                <AppText variant="caption" color="secondary">
                  {formatInvitationDate(item.createdAt)}
                </AppText>
              </Card>
            )}
            ListEmptyComponent={<AppText color="muted">Você ainda não convidou nenhum prestador.</AppText>}
          />
        )}
      </View>
    </Screen>
  );
}
