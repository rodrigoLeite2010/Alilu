import { Redirect, Stack } from 'expo-router';

import { useAuth } from '../../modules/auth';

/**
 * ProfessionalStack — telas voltadas ao profissional. Desde o PROMPT 06, o
 * próprio `index` decide (com base em `useMyProfessionalProfile`) se
 * mostra o formulário de criação de perfil ou o próprio perfil (edição +
 * serviços + condomínios) — mesmo padrão de `(resident)/index.tsx`
 * (PROMPT 05).
 *
 * Desde o PROMPT 07, `availability/*` reúne as quatro telas de
 * disponibilidade (AvailabilityScreen/AvailabilityEditor/
 * BlockedDatesScreen/CalendarAvailabilityScreen) — desde a Etapa 19,
 * reaproveitadas como a opção "Avançado" a partir do novo hub `agenda/*`.
 *
 * Etapa 19 (agenda e disponibilidade): `agenda/*` reúne "Minha Agenda"
 * (MyAgendaScreen — visão por dia/período de Disponível/Agendado/Bloqueado/
 * Indisponível) e "Adicionar disponibilidade"/"Configurar rotina semanal"
 * (AddAvailabilityScreen, uma única tela para os dois fluxos — ver
 * comentário na própria tela), acessíveis a partir de "Minha Agenda" em
 * ProfessionalEditScreen (antes "Configurar disponibilidade").
 *
 * Desde o PROMPT 08 ("o módulo mais crítico"), `requests/*` reúne o fluxo
 * "receber solicitação → aceitar ou recusar" (ProfessionalRequestsScreen/
 * BookingDetailsScreen, módulo Scheduling), acessível a partir de
 * "Solicitações" em ProfessionalEditScreen.
 *
 * Desde o PROMPT 09, `reviews/index` (ProfessionalReviewsScreen, módulo
 * Reviews — "visualizar avaliações recebidas; visualizar média") é
 * acessível a partir de "Avaliações" em ProfessionalEditScreen.
 *
 * Bug real encontrado testando no navegador (`expo start --web`): nada
 * aqui barrava quem não está autenticado — ao limpar a sessão manualmente
 * (Local Storage) e recarregar, esta tela continuava aberta e só as
 * chamadas à Api voltavam 401 em cascata, sem nunca levar de volta ao
 * login. `(auth)/_layout.tsx` já fazia o caminho inverso (redireciona para
 * fora de login quem já está autenticado) — faltava o mesmo tipo de guarda
 * aqui, em `(resident)/_layout.tsx` e em `(administration)/_layout.tsx`.
 */
export default function ProfessionalLayout() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="availability/index" />
      <Stack.Screen name="availability/editor" />
      <Stack.Screen name="availability/blocked-dates" />
      <Stack.Screen name="availability/calendar" />
      <Stack.Screen name="agenda/index" />
      <Stack.Screen name="agenda/add" />
      <Stack.Screen name="requests/index" />
      <Stack.Screen name="requests/[id]" />
      <Stack.Screen name="reviews/index" />
    </Stack>
  );
}
