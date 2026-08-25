/**
 * Espelha `Alilu.Modules.Professional.Application/Dtos.cs` e
 * `Domain/ProfessionalStatus.cs`/`ProfessionalCondominiumStatus.cs`/
 * `ProfessionalCondominiumSource.cs` (PROMPT 06). A Api serializa enums
 * como string e usa camelCase — ver `modules/auth/types.ts` para a mesma
 * observação já registrada no PROMPT 03.
 */
export type ProfessionalStatus = 'Active' | 'Inactive';

export type ProfessionalCondominiumStatus = 'Pending' | 'Active' | 'Rejected' | 'Inactive';

export type ProfessionalCondominiumSource =
  | 'AdminApproved'
  | 'ResidentRecommended'
  | 'CompletedService'
  | 'ProfessionalRequested';

export interface Professional {
  id: string;
  userId: string;
  displayName: string;
  description: string | null;
  phone: string | null;
  photoUrl: string | null;
  status: ProfessionalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface ProfessionalServiceItem {
  id: string;
  professionalId: string;
  serviceCategoryId: string;
  description: string | null;
  active: boolean;
}

export interface ProfessionalCondominiumLink {
  id: string;
  professionalId: string;
  condominiumId: string;
  status: ProfessionalCondominiumStatus;
  source: ProfessionalCondominiumSource;
  createdAt: string;
}

/** Item de diretório público (React Native: ProfessionalListScreen/ProfessionalProfileScreen). */
export interface ProfessionalDirectoryItem {
  id: string;
  displayName: string;
  description: string | null;
  phone: string | null;
  photoUrl: string | null;
  categories: ServiceCategory[];
}

/** Espelha `Alilu.Modules.Condominium.Application/Dtos.cs` — mesmo formato usado pelo módulo Resident (ver `modules/resident/types.ts`), aqui para o profissional escolher onde "solicitar atendimento". */
export interface CondominiumSummary {
  id: string;
  name: string;
  city: string;
  state: string;
}

export interface SaveProfessionalProfilePayload {
  displayName: string;
  description?: string;
  phone?: string;
  photoUrl?: string;
}

export interface AddProfessionalServicePayload {
  serviceCategoryId: string;
  description?: string;
}

export interface RequestProfessionalCondominiumPayload {
  condominiumId: string;
}
