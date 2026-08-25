import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { directoryApi, membershipApi } from './api';
import type { RedeemInvitationPayload, RequestResidentAccessPayload } from './types';

/**
 * Chave única para as duas queries de vínculo do usuário — usada tanto
 * para o gate (`(resident)/index.tsx`, que precisa da lista completa para
 * distinguir "nenhum vínculo" de "vínculo Pending") quanto para
 * invalidar depois de resgatar um convite/enviar uma solicitação.
 */
const MY_MEMBERSHIPS_QUERY_KEY = ['resident', 'memberships', 'mine'];

/**
 * Todos os vínculos do usuário autenticado. O gate do app (ver
 * `(resident)/index.tsx`) decide o que mostrar a partir disto: um vínculo
 * Active manda para a área do morador; só Pending manda para
 * WaitingApproval; nenhum vínculo manda para o início do fluxo de
 * validação (ChooseCondominium/EnterInvitationCode) — "acesso sem
 * vínculo" (PROMPT 05).
 */
export function useMyMemberships() {
  return useQuery({
    queryKey: MY_MEMBERSHIPS_QUERY_KEY,
    queryFn: () => membershipApi.listMine(),
  });
}

export function useRedeemInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RedeemInvitationPayload) => membershipApi.redeemInvitation(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_MEMBERSHIPS_QUERY_KEY }),
  });
}

export function useRequestResidentAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RequestResidentAccessPayload) => membershipApi.requestAccess(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_MEMBERSHIPS_QUERY_KEY }),
  });
}

/** Diretório público de condomínios ativos (FLUXO 2 — ver ChooseCondominiumScreen). */
export function useCondominiums() {
  return useQuery({
    queryKey: ['resident', 'directory', 'condominiums'],
    queryFn: () => directoryApi.listCondominiums(),
  });
}

/** Unidades ativas de um condomínio já escolhido — só habilitada quando `condominiumId` existe (ver RequestResidentAccessScreen). */
export function useCondominiumUnits(condominiumId: string | undefined) {
  return useQuery({
    queryKey: ['resident', 'directory', 'units', condominiumId],
    queryFn: () => directoryApi.listUnits(condominiumId as string),
    enabled: Boolean(condominiumId),
  });
}
