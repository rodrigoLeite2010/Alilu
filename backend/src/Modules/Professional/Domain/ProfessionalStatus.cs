namespace Alilu.Modules.Professional.Domain;

/// <summary>
/// Situação do perfil de <see cref="Professional"/> (não confundir com
/// <see cref="ProfessionalCondominiumStatus"/>, que é por condomínio).
///
/// Active: perfil visível no diretório público (ver
/// <c>IProfessionalDirectoryService</c>). Inactive: perfil desativado pelo
/// próprio profissional ou por um administrador — não aparece mais na
/// busca do morador.
/// </summary>
public enum ProfessionalStatus
{
    Active = 1,
    Inactive = 2,
}
