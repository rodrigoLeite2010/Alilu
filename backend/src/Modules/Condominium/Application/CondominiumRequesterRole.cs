namespace Alilu.Modules.Condominium.Application;

/// <summary>
/// Papel de quem está chamando um caso de uso deste módulo, para a
/// verificação de autorização em <see cref="CondominiumService"/> (ver
/// <c>EnsureIsAdmin</c>). Espelha os nomes de
/// <c>Alilu.Modules.Identity.Domain.UserRole</c> de propósito — assim a Api
/// consegue converter o claim de papel do JWT (ex.: "CondominiumAdmin")
/// direto para este enum com <c>Enum.TryParse</c> — mas é um tipo
/// independente: este módulo não referencia o módulo Identity (regra do
/// PROMPT 01).
/// </summary>
public enum CondominiumRequesterRole
{
    Resident = 1,
    Professional = 2,
    CondominiumAdmin = 3,
    SuperAdmin = 4,
}
