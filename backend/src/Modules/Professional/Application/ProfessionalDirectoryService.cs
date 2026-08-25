namespace Alilu.Modules.Professional.Application;

/// <summary>Implementação de <see cref="IProfessionalDirectoryService"/> — ver comentário de design lá.</summary>
public sealed class ProfessionalDirectoryService(
    IProfessionalRepository professionalRepository,
    IServiceCategoryRepository serviceCategoryRepository,
    IProfessionalServiceRepository professionalServiceRepository) : IProfessionalDirectoryService
{
    public async Task<IReadOnlyList<ServiceCategoryResponse>> ListCategoriesAsync(CancellationToken cancellationToken = default)
    {
        var categories = await serviceCategoryRepository.ListActiveAsync(cancellationToken);
        return categories.Select(ProfessionalMapper.ToResponse).ToList();
    }

    public async Task<IReadOnlyList<ProfessionalDirectoryItemResponse>> ListProfessionalsAsync(Guid? serviceCategoryId, CancellationToken cancellationToken = default)
    {
        var professionals = await professionalRepository.ListActiveAsync(serviceCategoryId, cancellationToken);
        return await ToDirectoryItemsAsync(professionals, cancellationToken);
    }

    public async Task<ProfessionalDirectoryItemResponse?> GetProfessionalProfileAsync(Guid professionalId, CancellationToken cancellationToken = default)
    {
        var professional = await professionalRepository.GetByIdAsync(professionalId, cancellationToken);
        if (professional is null || !professional.IsActive)
        {
            return null;
        }

        var items = await ToDirectoryItemsAsync(new[] { professional }, cancellationToken);
        return items.Single();
    }

    private async Task<IReadOnlyList<ProfessionalDirectoryItemResponse>> ToDirectoryItemsAsync(
        IReadOnlyList<Domain.Professional> professionals,
        CancellationToken cancellationToken)
    {
        if (professionals.Count == 0)
        {
            return Array.Empty<ProfessionalDirectoryItemResponse>();
        }

        var professionalIds = professionals.Select(p => p.Id).ToList();
        var activeServices = await professionalServiceRepository.ListActiveByProfessionalIdsAsync(professionalIds, cancellationToken);

        var categoryIds = activeServices.Select(s => s.ServiceCategoryId).Distinct().ToList();
        var categories = (await serviceCategoryRepository.ListAsync(cancellationToken))
            .Where(c => categoryIds.Contains(c.Id))
            .ToDictionary(c => c.Id);

        return professionals
            .Select(professional =>
            {
                var categoriesForProfessional = activeServices
                    .Where(s => s.ProfessionalId == professional.Id)
                    .Select(s => categories.GetValueOrDefault(s.ServiceCategoryId))
                    .Where(c => c is not null)
                    .Select(c => c!);

                return ProfessionalMapper.ToDirectoryItem(professional, categoriesForProfessional);
            })
            .ToList();
    }
}
