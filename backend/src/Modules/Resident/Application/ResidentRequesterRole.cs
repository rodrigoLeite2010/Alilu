namespace Alilu.Modules.Resident.Application;

/// <summary>
/// Papel de quem está chamando um caso de uso administrativo deste módulo
/// (aprovar/rejeitar/bloquear vínculo — ver
/// <see cref="IMembershipAdministrationService"/>). Espelha
/// <c>Alilu.Modules.Condominium.Application.CondominiumRequesterRole</c> de
/// propósito (mesmos nomes/valores de
/// <c>Alilu.Modules.Identity.Domain.UserRole</c>), mas é um tipo
/// independente — este módulo não referencia o módulo Condominium nem o
/// Identity (regra do PROMPT 01).
/// </summary>
public enum ResidentRequesterRole
{
    Resident = 1,
    Professional = 2,
    CondominiumAdmin = 3,
    SuperAdmin = 4,
}
