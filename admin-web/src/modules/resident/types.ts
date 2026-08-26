/** Espelha `Alilu.Modules.Resident.Application/Dtos.cs` e `Domain/MembershipStatus.cs`. */
export type MembershipStatus = 'Pending' | 'Active' | 'Rejected' | 'Blocked';

/**
 * Espelha `MembershipAdminResponse` (Api, `AdminMembershipsController.cs`)
 * — `CondominiumMembership` (módulo Resident) só guarda `userId`; a Api
 * compõe nome/e-mail via Identity (`IAuthService.GetUsersByIdsAsync`) para
 * o admin-web não precisar de uma segunda chamada por morador.
 */
export interface Membership {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  condominiumId: string;
  unitId: string;
  status: MembershipStatus;
  validatedAt: string | null;
  validatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
