using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Porta de persistência de <see cref="ProfessionalAvailability"/>.</summary>
public interface IProfessionalAvailabilityRepository
{
    Task<ProfessionalAvailability?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Todos os intervalos do profissional (Active e inativos) — mesmo padrão de <c>IProfessionalServiceRepository.ListByProfessionalIdAsync</c>: a Application decide o que exibir/comparar (ex.: checagem de sobreposição só considera os Active).</summary>
    Task<IReadOnlyList<ProfessionalAvailability>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default);

    Task AddAsync(ProfessionalAvailability availability, CancellationToken cancellationToken = default);
}
