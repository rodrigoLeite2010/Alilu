/**
 * Espelha `Alilu.Modules.Resident.Application/Dtos.cs` e
 * `Domain/MembershipStatus.cs` (vínculo morador↔condomínio↔unidade,
 * PROMPT 05), e os DTOs de diretório público do módulo Condominium
 * (`CondominiumSummaryResponse`/`CondominiumUnitSummaryResponse`). A Api
 * serializa enums como string e usa camelCase — ver `modules/auth/types.ts`
 * para a mesma observação já registrada no PROMPT 03.
 */
export type MembershipStatus = 'Pending' | 'Active' | 'Rejected' | 'Blocked';

export interface Membership {
  id: string;
  userId: string;
  condominiumId: string;
  unitId: string;
  status: MembershipStatus;
  validatedAt: string | null;
  validatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Espelha `Alilu.Modules.Condominium.Domain/UnitType.cs`. */
export type UnitType = 'Apartment' | 'House' | 'Commercial';

export interface CondominiumSummary {
  id: string;
  name: string;
  city: string;
  state: string;
}

export interface CondominiumUnitSummary {
  id: string;
  code: string;
  type: UnitType;
}

export interface RedeemInvitationPayload {
  code: string;
  /** O app sempre envia o e-mail do próprio usuário autenticado — ver `EnterInvitationCodeScreen`. */
  email?: string;
}

export interface RequestResidentAccessPayload {
  condominiumId: string;
  unitId: string;
}
