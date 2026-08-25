using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Porta de persistência de <see cref="ProfessionalCondominium"/>.</summary>
public interface IProfessionalCondominiumRepository
{
    Task<ProfessionalCondominium?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ProfessionalCondominium>> ListByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default);

    /// <summary>Checagem de duplicidade (ver <see cref="DuplicateProfessionalCondominiumException"/>) — Pending e Active contam como "já vinculado"; Rejected/Inactive não impedem uma nova tentativa.</summary>
    Task<bool> ExistsActiveOrPendingAsync(Guid professionalId, Guid condominiumId, CancellationToken cancellationToken = default);

    /// <summary>Fila de aprovação administrativa.</summary>
    Task<IReadOnlyList<ProfessionalCondominium>> ListPendingAsync(CancellationToken cancellationToken = default);

    Task AddAsync(ProfessionalCondominium professionalCondominium, CancellationToken cancellationToken = default);
}
