namespace Alilu.Modules.Professional.Application;

/// <summary>
/// Diretório público de profissionais/categorias (PROMPT 06, React Native
/// para o morador: ProfessionalListScreen/ServiceCategoryScreen/
/// ProfessionalProfileScreen — "listar profissionais; filtrar categoria;
/// visualizar perfil") — self-service, sem checagem de papel
/// administrativo, mesmo espírito de
/// <c>Alilu.Modules.Condominium.Application.ICondominiumDirectoryService</c>.
///
/// Só devolve perfis <see cref="Domain.ProfessionalStatus.Active"/> — um
/// perfil desativado não deve aparecer na busca do morador.
/// </summary>
public interface IProfessionalDirectoryService
{
    Task<IReadOnlyList<ServiceCategoryResponse>> ListCategoriesAsync(CancellationToken cancellationToken = default);

    /// <summary>Lista profissionais ativos; quando <paramref name="serviceCategoryId"/> é informado, filtra só quem oferece aquela categoria (React Native: "filtrar categoria").</summary>
    Task<IReadOnlyList<ProfessionalDirectoryItemResponse>> ListProfessionalsAsync(Guid? serviceCategoryId, CancellationToken cancellationToken = default);

    /// <summary>React Native: "visualizar perfil". Devolve <c>null</c> quando o perfil não existe ou não está mais ativo.</summary>
    Task<ProfessionalDirectoryItemResponse?> GetProfessionalProfileAsync(Guid professionalId, CancellationToken cancellationToken = default);
}
