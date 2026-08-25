namespace Alilu.Modules.Professional.Application;

/// <summary>
/// Papel de quem está chamando um caso de uso administrativo deste módulo
/// (aprovar/rejeitar solicitação de atendimento a um condomínio — ver
/// <see cref="IProfessionalAdministrationService"/>). Espelha
/// <c>Alilu.Modules.Resident.Application.ResidentRequesterRole</c> de
/// propósito (mesmos nomes/valores de
/// <c>Alilu.Modules.Identity.Domain.UserRole</c>), mas é um tipo
/// independente — este módulo não referencia nenhum outro módulo (regra
/// do PROMPT 01).
/// </summary>
public enum ProfessionalRequesterRole
{
    Resident = 1,
    Professional = 2,
    CondominiumAdmin = 3,
    SuperAdmin = 4,
}
