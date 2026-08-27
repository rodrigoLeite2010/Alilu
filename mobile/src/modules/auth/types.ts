/**
 * Espelha `Alilu.Modules.Identity.Application/Dtos.cs` e
 * `Domain/UserRole.cs`/`UserStatus.cs` do backend. A Api serializa enums
 * como string (ver `Program.cs` — `JsonStringEnumConverter`) e usa
 * camelCase (padrão do ASP.NET Core), então os tipos abaixo usam os
 * mesmos nomes/valores.
 */
export type UserRole = 'Resident' | 'Professional' | 'CondominiumAdmin' | 'SuperAdmin';

/** Papéis que o próprio usuário pode escolher ao se cadastrar — ver `AuthService.RegisterAsync`. */
export type SelfRegisterableRole = Extract<UserRole, 'Resident' | 'Professional'>;

export type UserStatus = 'Inactive' | 'Active' | 'Blocked';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** Etapa 21 — foto pessoal, mostrada ao lado do nome (qualquer papel). `null` até o usuário definir uma; ver `components/EditableAvatar`. */
  photoUrl: string | null;
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

export interface RegisterPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: SelfRegisterableRole;
}
