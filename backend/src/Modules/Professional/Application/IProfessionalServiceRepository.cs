using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Porta de persistência de <see cref="ProfessionalService"/>.</summary>
public interface IProfessionalServiceRepository
{
    Task<ProfessionalService?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ProfessionalService>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default);

    /// <summary>Usado tanto para o diretório (resolver categorias de vários profissionais de uma vez) quanto internamente por <see cref="IProfessionalRepository.ListActiveAsync"/>.</summary>
    Task<IReadOnlyList<ProfessionalService>> ListActiveByProfessionalIdsAsync(IReadOnlyCollection<Guid> professionalIds, CancellationToken cancellationToken = default);

    /// <summary>Checagem de duplicidade (ver <see cref="DuplicateProfessionalServiceException"/>) — só um serviço ativo por categoria por profissional.</summary>
    Task<bool> ExistsActiveAsync(Guid professionalId, Guid serviceCategoryId, CancellationToken cancellationToken = default);

    Task AddAsync(ProfessionalService professionalService, CancellationToken cancellationToken = default);
}
