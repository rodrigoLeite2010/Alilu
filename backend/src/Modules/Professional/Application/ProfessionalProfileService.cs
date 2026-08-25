using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Implementação de <see cref="IProfessionalProfileService"/> — ver comentário de design/segurança lá.</summary>
public sealed class ProfessionalProfileService(
    IProfessionalRepository professionalRepository,
    IServiceCategoryRepository serviceCategoryRepository,
    IProfessionalServiceRepository professionalServiceRepository,
    IProfessionalCondominiumRepository professionalCondominiumRepository,
    IUnitOfWork unitOfWork) : IProfessionalProfileService
{
    public async Task<ProfessionalResponse?> GetMyProfileAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var professional = await professionalRepository.GetByUserIdAsync(userId, cancellationToken);
        return professional is null ? null : ProfessionalMapper.ToResponse(professional);
    }

    public async Task<ProfessionalResponse> CreateProfileAsync(
        Guid userId,
        string displayName,
        string? description,
        string? phone,
        string? photoUrl,
        CancellationToken cancellationToken = default)
    {
        if (await professionalRepository.GetByUserIdAsync(userId, cancellationToken) is not null)
        {
            throw new ProfessionalAlreadyExistsException();
        }

        var professional = Domain.Professional.Register(userId, displayName, description, phone, photoUrl);

        await professionalRepository.AddAsync(professional, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ProfessionalMapper.ToResponse(professional);
    }

    public async Task<ProfessionalResponse> UpdateMyProfileAsync(
        Guid userId,
        string displayName,
        string? description,
        string? phone,
        string? photoUrl,
        CancellationToken cancellationToken = default)
    {
        var professional = await GetOwnProfileOrThrowAsync(userId, cancellationToken);

        professional.UpdateProfile(displayName, description, phone, photoUrl);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ProfessionalMapper.ToResponse(professional);
    }

    public async Task<IReadOnlyList<ProfessionalServiceResponse>> ListMyServicesAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var professional = await GetOwnProfileOrThrowAsync(userId, cancellationToken);

        var services = await professionalServiceRepository.ListByProfessionalIdAsync(professional.Id, cancellationToken);
        return services.Select(ProfessionalMapper.ToResponse).ToList();
    }

    public async Task<ProfessionalServiceResponse> AddMyServiceAsync(
        Guid userId,
        Guid serviceCategoryId,
        string? description,
        CancellationToken cancellationToken = default)
    {
        var professional = await GetOwnProfileOrThrowAsync(userId, cancellationToken);

        var category = await serviceCategoryRepository.GetByIdAsync(serviceCategoryId, cancellationToken)
            ?? throw new ServiceCategoryNotFoundException();

        if (!category.Active)
        {
            throw new ServiceCategoryInactiveException();
        }

        if (await professionalServiceRepository.ExistsActiveAsync(professional.Id, serviceCategoryId, cancellationToken))
        {
            throw new DuplicateProfessionalServiceException();
        }

        var service = ProfessionalService.Create(professional.Id, serviceCategoryId, description);

        await professionalServiceRepository.AddAsync(service, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ProfessionalMapper.ToResponse(service);
    }

    public async Task RemoveMyServiceAsync(Guid userId, Guid professionalServiceId, CancellationToken cancellationToken = default)
    {
        var professional = await GetOwnProfileOrThrowAsync(userId, cancellationToken);

        var service = await professionalServiceRepository.GetByIdAsync(professionalServiceId, cancellationToken)
            ?? throw new ProfessionalServiceNotFoundException();

        // Segunda camada de defesa: um serviço só pode ser removido pelo
        // próprio dono do perfil — nunca pelo Id de outro profissional.
        if (service.ProfessionalId != professional.Id)
        {
            throw new ProfessionalServiceNotFoundException();
        }

        service.Deactivate();
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ProfessionalCondominiumResponse>> ListMyCondominiumsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var professional = await GetOwnProfileOrThrowAsync(userId, cancellationToken);

        var condominiums = await professionalCondominiumRepository.ListByProfessionalIdAsync(professional.Id, cancellationToken);
        return condominiums.Select(ProfessionalMapper.ToResponse).ToList();
    }

    public async Task<ProfessionalCondominiumResponse> RequestCondominiumAsync(
        Guid userId,
        Guid condominiumId,
        CancellationToken cancellationToken = default)
    {
        var professional = await GetOwnProfileOrThrowAsync(userId, cancellationToken);

        if (await professionalCondominiumRepository.ExistsActiveOrPendingAsync(professional.Id, condominiumId, cancellationToken))
        {
            throw new DuplicateProfessionalCondominiumException();
        }

        var professionalCondominium = ProfessionalCondominium.RequestService(professional.Id, condominiumId);

        await professionalCondominiumRepository.AddAsync(professionalCondominium, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ProfessionalMapper.ToResponse(professionalCondominium);
    }

    private async Task<Domain.Professional> GetOwnProfileOrThrowAsync(Guid userId, CancellationToken cancellationToken) =>
        await professionalRepository.GetByUserIdAsync(userId, cancellationToken)
            ?? throw new ProfessionalNotFoundException();
}
