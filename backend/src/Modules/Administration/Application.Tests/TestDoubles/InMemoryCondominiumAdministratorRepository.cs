using Alilu.Modules.Administration.Application;
using Alilu.Modules.Administration.Domain;

namespace Alilu.Modules.Administration.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="ICondominiumAdministratorRepository"/>.</summary>
public sealed class InMemoryCondominiumAdministratorRepository : ICondominiumAdministratorRepository
{
    private readonly Dictionary<Guid, CondominiumAdministrator> _administrators = new();

    public Task<CondominiumAdministrator?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_administrators.Values.FirstOrDefault(a => a.UserId == userId));

    public Task<IReadOnlyList<CondominiumAdministrator>> ListAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<CondominiumAdministrator>>(
            _administrators.Values.OrderBy(a => a.CreatedAt).ToList());

    public Task AddAsync(CondominiumAdministrator administrator, CancellationToken cancellationToken = default)
    {
        _administrators[administrator.Id] = administrator;
        return Task.CompletedTask;
    }
}
