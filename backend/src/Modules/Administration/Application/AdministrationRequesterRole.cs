namespace Alilu.Modules.Administration.Application;

/// <summary>
/// Papel de quem está chamando um caso de uso deste módulo — mesmo padrão de
/// <c>ResidentRequesterRole</c>/<c>ProfessionalRequesterRole</c>/
/// <c>RecommendationRequesterRole</c>: espelha os nomes/valores de
/// <c>Identity.UserRole</c>, mas é um tipo próprio deste módulo (nenhum
/// módulo referencia outro — PROMPT 01). A Api resolve o valor a partir da
/// claim de papel do usuário autenticado (ver
/// <c>ClaimsPrincipalExtensions.GetAdministrationRequesterRole</c>).
/// </summary>
public enum AdministrationRequesterRole
{
    Resident = 1,
    Professional = 2,
    CondominiumAdmin = 3,
    SuperAdmin = 4,
}
