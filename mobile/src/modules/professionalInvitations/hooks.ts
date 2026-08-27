import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { professionalInvitationApi } from './api';
import type { CreateProfessionalInvitationPayload } from './types';

const MY_INVITATIONS_QUERY_KEY = ['professional-invitations', 'mine'];

/** React Native: tela "Convidar prestador" — histórico "convites enviados". */
export function useMyProfessionalInvitations() {
  return useQuery({
    queryKey: MY_INVITATIONS_QUERY_KEY,
    queryFn: () => professionalInvitationApi.listMine(),
  });
}

/** React Native: tela "Convidar prestador". */
export function useCreateProfessionalInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateProfessionalInvitationPayload) => professionalInvitationApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_INVITATIONS_QUERY_KEY });
    },
  });
}
