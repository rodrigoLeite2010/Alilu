using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Identity.Application;
using Alilu.Modules.Identity.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Identity.Infrastructure.Persistence;

/// <summary>
/// Implementação de <see cref="IRefreshTokenRepository"/> usando o
/// <see cref="AliluDbContext"/> compartilhado (raiz).
/// </summary>
public sealed class RefreshTokenRepository(AliluDbContext dbContext) : IRefreshTokenRepository
{
    public Task<RefreshToken?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default) =>
        dbContext.Set<RefreshToken>()
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);

    public async Task AddAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default) =>
        await dbContext.Set<RefreshToken>().AddAsync(refreshToken, cancellationToken);
}
