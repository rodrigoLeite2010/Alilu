/**
 * Espelha `Alilu.Modules.Mural.Application/Dtos.cs` (Etapa 23, pedido 3 de
 * Rodrigo: "ter uma opcao de Mural, onde e texto aberto por morador,
 * reclamacoes, sugestoes, falar de algum prestador nao cadastrado
 * negativar e avisar por quaisquer problemas"). A Api serializa em
 * camelCase — mesma observação já registrada em `modules/recommendations/types.ts`.
 */
export type MuralPostType = 'Complaint' | 'Suggestion' | 'Warning' | 'UnregisteredProfessional';

export type MuralPostStatus = 'Visible' | 'Blocked';

export interface MuralPost {
  id: string;
  condominiumId: string;
  authorUserId: string;
  type: MuralPostType;
  content: string;
  status: MuralPostStatus;
  createdAt: string;
  blockedAt: string | null;
  blockedBy: string | null;
}

/** Corpo de `POST /api/resident/mural` (React Native: tela "Novo post" do Mural). */
export interface CreateMuralPostPayload {
  type: MuralPostType;
  content: string;
}
