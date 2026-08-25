using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Identity.Application;
using Alilu.Modules.Identity.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Identity.Infrastructure.Persistence;

/// <summary>
/// Implementação de <see cref="IUserRepository"/> usando o
/// <see cref="AliluDbContext"/> compartilhado (raiz).
/// </summary>
public sealed class UserRepository(AliluDbContext dbContext) : IUserRepository
{
    public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<User>()
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

    public Task<User?> GetByEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default) =>
        dbContext.Set<User>()
            .FirstOrDefaultAsync(u => u.Email.Value == normalizedEmail, cancellationToken);

    public Task<bool> ExistsByEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default) =>
        dbContext.Set<User>()
            .AnyAsync(u => u.Email.Value == normalizedEmail, cancellationToken);

    public async Task AddAsync(User user, CancellationToken cancellationToken = default) =>
        await dbContext.Set<User>().AddAsync(user, cancellationToken);
}
