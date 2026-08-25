using Alilu.Modules.Condominium.Domain;

namespace Alilu.Modules.Condominium.Application;

/// <summary>
/// Porta de persistência de <see cref="Domain.Condominium"/>. Implementada
/// em Infrastructure (EF Core); aqui é só a abstração usada pela
/// Application.
/// </summary>
public interface ICondominiumRepository
{
    Task<Domain.Condominium?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Domain.Condominium>> ListAsync(CancellationToken cancellationToken = default);

    Task<bool> ExistsByCnpjAsync(string normalizedCnpj, CancellationToken cancellationToken = default);

    Task AddAsync(Domain.Condominium condominium, CancellationToken cancellationToken = default);
}
