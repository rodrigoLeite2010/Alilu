using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Porta de persistência de <see cref="ProfessionalAvailabilityException"/>.</summary>
public interface IProfessionalAvailabilityExceptionRepository
{
    Task<ProfessionalAvailabilityException?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ProfessionalAvailabilityException>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default);

    /// <summary>Exceções do profissional na mesma data — usado para checar "não permitir horários sobrepostos" antes de criar uma nova.</summary>
    Task<IReadOnlyList<ProfessionalAvailabilityException>> ListByProfessionalIdAndDateAsync(Guid professionalId, DateOnly date, CancellationToken cancellationToken = default);

    Task AddAsync(ProfessionalAvailabilityException exception, CancellationToken cancellationToken = default);

    /// <summary>
    /// Exclusão definitiva — ao contrário do restante do módulo (que só
    /// desativa, nunca apaga — ver <c>ProfessionalService.Deactivate</c>),
    /// uma exceção não tem "reativar": ela é, por natureza, um ajuste
    /// pontual e transitório; removê-la É o próprio ato de desbloquear/
    /// desliberar a data (a agenda recorrente volta a valer). Ver
    /// ARCHITECTURE.md para a decisão completa.
    /// </summary>
    Task RemoveAsync(ProfessionalAvailabilityException exception, CancellationToken cancellationToken = default);
}
