using Alilu.Modules.Condominium.Application;

namespace Alilu.Modules.Condominium.Application.Tests.TestDoubles;

/// <summary>
/// Fake em memória de <see cref="ICondominiumRepository"/>, usado nos
/// testes no lugar do EF Core real — mesmo espírito de
/// InMemoryUserRepository no módulo Identity.
/// </summary>
public sealed class InMemoryCondominiumRepository : ICondominiumRepository
{
    private readonly Dictionary<Guid, Domain.Condominium> _condominiums = new();

    public IReadOnlyCollection<Domain.Condominium> Condominiums => _condominiums.Values.ToList();

    public Task<Domain.Condominium?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_condominiums.GetValueOrDefault(id));

    public Task<IReadOnlyList<Domain.Condominium>> ListAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Domain.Condominium>>(_condominiums.Values.OrderBy(c => c.Name).ToList());

    public Task<bool> ExistsByCnpjAsync(string normalizedCnpj, CancellationToken cancellationToken = default) =>
        Task.FromResult(_condominiums.Values.Any(c => c.Cnpj.Value == normalizedCnpj));

    public Task AddAsync(Domain.Condominium condominium, CancellationToken cancellationToken = default)
    {
        _condominiums[condominium.Id] = condominium;
        return Task.CompletedTask;
    }
}
