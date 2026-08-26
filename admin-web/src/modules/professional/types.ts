/** Espelha `Alilu.Modules.Professional.Application/Dtos.cs` e `Domain/ProfessionalCondominiumStatus.cs`/`ProfessionalCondominiumSource.cs`. */
export type ProfessionalCondominiumStatus = 'Pending' | 'Active' | 'Rejected' | 'Inactive';
export type ProfessionalCondominiumSource =
  | 'AdminApproved'
  | 'ResidentRecommended'
  | 'CompletedService'
  | 'ProfessionalRequested';

export interface ProfessionalCondominium {
  id: string;
  professionalId: string;
  condominiumId: string;
  status: ProfessionalCondominiumStatus;
  source: ProfessionalCondominiumSource;
  createdAt: string;
}

/** Espelha `ProfessionalDirectoryItemResponse` (`GET /api/directory/professionals`) — usado aqui só para resolver nome/foto, não para o fluxo público do morador. */
export interface ProfessionalDirectoryItem {
  id: string;
  displayName: string;
  description: string | null;
  phone: string | null;
  photoUrl: string | null;
}
