/** Espelha `Alilu.Modules.Mural.Application/Dtos.cs` e `Domain/MuralPostType.cs`/`MuralPostStatus.cs` (Etapa 23). */
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
