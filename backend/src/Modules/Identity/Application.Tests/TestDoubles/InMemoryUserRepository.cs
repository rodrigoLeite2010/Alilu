using Alilu.Modules.Identity.Application;
using Alilu.Modules.Identity.Domain;

namespace Alilu.Modules.Identity.Application.Tests.TestDoubles;

/// <summary>
/// Fake em memória de <see cref="IUserRepository"/>, usado nos testes no
/// lugar do EF Core real (que pertence à Infrastructure e depende de
/// Postgres). Testa exatamente o contrato que <see cref="AuthService"/>
/// consome.
/// </summary>
public sealed class InMemoryUserRepository : IUserRepository
{
    private readonly Dictionary<Guid, User> _users = new();

    public IReadOnlyCollection<User> Users => _users.Values.ToList();

    public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_users.GetValueOrDefault(id));

    public Task<User?> GetByEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default) =>
        Task.FromResult(_users.Values.FirstOrDefault(u => u.Email.Value == normalizedEmail));

    public Task<bool> ExistsByEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default) =>
        Task.FromResult(_users.Values.Any(u => u.Email.Value == normalizedEmail));

    public Task<IReadOnlyList<User>> ListByIdsAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<User>>(_users.Values.Where(u => ids.Contains(u.Id)).ToList());

    public Task AddAsync(User user, CancellationToken cancellationToken = default)
    {
        _users[user.Id] = user;
        return Task.CompletedTask;
    }
}
