import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { AppButton, AppText, Badge, Card, Screen } from '../../../components';
import { useTheme } from '../../../theme';
import { DAY_OF_WEEK_LABEL, DAY_OF_WEEK_ORDER } from '../availabilityFormat';
import { useMyAgenda } from '../hooks';
import type { AgendaPeriod, AgendaPeriodStatus } from '../types';

/** Quantos dias a partir de hoje "Minha Agenda" mostra de uma vez — bem abaixo do limite de 62 dias do backend (ver `GetMyOpenWindowsRangeAsync`); duas semanas é o bastante para o profissional planejar sem rolar uma lista enorme. */
const AGENDA_WINDOW_DAYS = 14;

const STATUS_LABEL: Record<AgendaPeriodStatus, string> = {
  Available: 'Disponível',
  Scheduled: 'Agendado',
  Blocked: 'Bloqueado',
  Unavailable: 'Indisponível',
};

// Etapa 20 — cada status ganha um `Badge` colorido (ver componente) no
// lugar do ícone de emoji cru; a legenda abaixo do cabeçalho usa os mesmos
// badges, então o significado de cada cor fica óbvio de relance.
const STATUS_TONE: Record<AgendaPeriodStatus, 'success' | 'accent' | 'error' | 'neutral'> = {
  Available: 'success',
  Scheduled: 'accent',
  Blocked: 'error',
  Unavailable: 'neutral',
};

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * React Native: MyAgendaScreen (Etapa 19) — "Minha Agenda": pensada para
 * alguém sem familiaridade com termos técnicos (pedido explícito do
 * produto: "pensando numa diarista") — um ícone por período, sem grade de
 * horários nem jargão. Ponto de entrada para os três fluxos novos:
 * "+ Adicionar disponibilidade", "📅 Configurar rotina semanal" (mesma tela
 * de "+ Adicionar disponibilidade", só o parâmetro `mode` muda — ver
 * `AddAvailabilityScreen`) e "🔒 Bloquear período" (reaproveita
 * BlockedDatesScreen, já existente desde o PROMPT 07 — "não duplicar
 * funcionalidade já existente").
 */
export function MyAgendaScreen() {
  const { spacing, colors } = useTheme();

  const { from, to, days } = useMemo(() => {
    const today = new Date();
    const fromDate = toDateOnlyString(today);
    const toDateValue = new Date(today);
    toDateValue.setDate(toDateValue.getDate() + (AGENDA_WINDOW_DAYS - 1));
    const toDate = toDateOnlyString(toDateValue);

    const dayList: { date: Date; iso: string }[] = [];
    for (let i = 0; i < AGENDA_WINDOW_DAYS; i += 1) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      dayList.push({ date, iso: toDateOnlyString(date) });
    }
    return { from: fromDate, to: toDate, days: dayList };
  }, []);

  const { data: agenda, isLoading, isError, refetch } = useMyAgenda(from, to);
  const agendaByDate = new Map((agenda ?? []).map((day) => [day.date, day.periods]));

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: spacing.md }}>
        <View>
          <AppText variant="title">Minha Agenda</AppText>
          <AppText variant="subtitle" color="secondary" style={{ marginTop: spacing.xxs }}>
            Veja de relance o que está disponível, agendado ou bloqueado nos próximos dias
          </AppText>
        </View>

        <View style={{ gap: spacing.xs }}>
          <AppButton
            label="+ Adicionar disponibilidade"
            onPress={() => router.push({ pathname: '/(professional)/agenda/add', params: { mode: 'quick' } })}
          />
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <AppButton
              label="📅 Configurar rotina semanal"
              variant="secondary"
              onPress={() => router.push({ pathname: '/(professional)/agenda/add', params: { mode: 'routine' } })}
            />
            <AppButton
              label="🔒 Bloquear período"
              variant="secondary"
              onPress={() => router.push('/(professional)/availability/blocked-dates')}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {(Object.keys(STATUS_LABEL) as AgendaPeriodStatus[]).map((status) => (
            <Badge key={status} label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
          ))}
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.brand.primary} />
        ) : isError ? (
          <View style={{ gap: spacing.xs }}>
            <AppText style={{ color: colors.semantic.error }}>Não foi possível carregar sua agenda.</AppText>
            <AppButton label="Tentar de novo" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <View style={{ gap: spacing.xs }}>
            {days.map(({ date, iso }) => {
              const periods = agendaByDate.get(iso) ?? [];
              return (
                <Card key={iso} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ width: 92 }}>
                    <AppText style={{ fontWeight: '600' }}>{`${DAY_OF_WEEK_LABEL[DAY_OF_WEEK_ORDER[(date.getDay() + 6) % 7]].slice(0, 3)} ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`}</AppText>
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.xs, flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {periods.length === 0 ? (
                      <AppText color="muted">—</AppText>
                    ) : (
                      periods.map((period: AgendaPeriod) => (
                        <View key={period.name} style={{ alignItems: 'center', gap: spacing.xxs / 2 }}>
                          <Badge label={period.name} tone={STATUS_TONE[period.status]} />
                        </View>
                      ))
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Nada foi removido do PROMPT 07 — quem quiser o controle fino original (um intervalo por vez, edição, calendário de exceções) continua acessível aqui. */}
        <AppButton
          label="Avançado (agenda detalhada por dia da semana)"
          variant="ghost"
          onPress={() => router.push('/(professional)/availability')}
        />
      </ScrollView>
    </Screen>
  );
}
