import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { AppButton, AppText, Screen } from '../../../components';
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

const STATUS_ICON: Record<AgendaPeriodStatus, string> = {
  Available: '🟢',
  Scheduled: '📅',
  Blocked: '🔒',
  Unavailable: '⬜',
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

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {(Object.keys(STATUS_LABEL) as AgendaPeriodStatus[]).map((status) => (
            <View key={status} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}>
              <AppText>{STATUS_ICON[status]}</AppText>
              <AppText variant="caption" color="secondary">
                {STATUS_LABEL[status]}
              </AppText>
            </View>
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
          <View style={{ gap: spacing.sm }}>
            {days.map(({ date, iso }) => {
              const periods = agendaByDate.get(iso) ?? [];
              return (
                <View
                  key={iso}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: spacing.xxs,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ width: 92 }}>
                    <AppText>{`${DAY_OF_WEEK_LABEL[DAY_OF_WEEK_ORDER[(date.getDay() + 6) % 7]].slice(0, 3)} ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`}</AppText>
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, flex: 1, justifyContent: 'flex-end' }}>
                    {periods.length === 0 ? (
                      <AppText color="muted">—</AppText>
                    ) : (
                      periods.map((period: AgendaPeriod) => (
                        <View key={period.name} style={{ alignItems: 'center' }}>
                          <AppText>{STATUS_ICON[period.status]}</AppText>
                          <AppText variant="caption" color="secondary">
                            {period.name}
                          </AppText>
                        </View>
                      ))
                    )}
                  </View>
                </View>
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
