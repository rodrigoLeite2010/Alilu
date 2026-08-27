import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { muralApi } from './api';
import type { CreateMuralPostPayload } from './types';

const MY_MURAL_QUERY_KEY = ['mural', 'mine'];

/** React Native: MuralScreen — feed do meu condomínio. */
export function useMyMuralFeed() {
  return useQuery({
    queryKey: MY_MURAL_QUERY_KEY,
    queryFn: () => muralApi.listMine(),
  });
}

/** React Native: tela "Novo post" do Mural. */
export function useCreateMuralPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateMuralPostPayload) => muralApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MY_MURAL_QUERY_KEY });
    },
  });
}
