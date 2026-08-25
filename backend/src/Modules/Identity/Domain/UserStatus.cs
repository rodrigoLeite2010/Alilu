namespace Alilu.Modules.Identity.Domain;

/// <summary>
/// Status da conta do usuário. Novos cadastros nascem <see cref="Active"/>
/// nesta etapa (não há verificação de e-mail implementada ainda —
/// <see cref="Inactive"/> está reservado para quando essa etapa existir).
/// </summary>
public enum UserStatus
{
    Inactive = 0,
    Active = 1,
    Blocked = 2,
}
