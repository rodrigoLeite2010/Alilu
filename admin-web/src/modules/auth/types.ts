/**
 * Espelha `Alilu.Modules.Identity.Application/Dtos.cs` e
 * `Domain/UserRole.cs`/`UserStatus.cs` do backend — mesmos tipos de
 * `mobile/src/modules/auth/types.ts` (a Api serializa enums como string —
 * ver `Program.cs`, `JsonStringEnumConverter`).
 */
export type UserRole = 'Resident' | 'Professional' | 'CondominiumAdmin' | 'SuperAdmin';

/** Papéis que podem entrar no admin-web (PROMPT 12: "AUTORIZAÇÃO"). */
export type AdminRole = Extract<UserRole, 'CondominiumAdmin' | 'SuperAdmin'>;

export type UserStatus = 'Inactive' | 'Active' | 'Blocked';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  user: AuthUser;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export function isAdminRole(role: UserRole): role is AdminRole {
  return role === 'CondominiumAdmin' || role === 'SuperAdmin';
}
