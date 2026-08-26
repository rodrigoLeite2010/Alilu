using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Notifications.Application;
using Alilu.Modules.Notifications.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Notifications.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="IDeviceTokenRepository"/> usando o <see cref="AliluDbContext"/> compartilhado (raiz).</summary>
public sealed class DeviceTokenRepository(AliluDbContext dbContext) : IDeviceTokenRepository
{
    public Task<DeviceToken?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        dbContext.Set<DeviceToken>().FirstOrDefaultAsync(t => t.UserId == userId, cancellationToken);

    public async Task AddAsync(DeviceToken deviceToken, CancellationToken cancellationToken = default) =>
        await dbContext.Set<DeviceToken>().AddAsync(deviceToken, cancellationToken);

    public Task RemoveAsync(DeviceToken deviceToken, CancellationToken cancellationToken = default)
    {
        dbContext.Set<DeviceToken>().Remove(deviceToken);
        return Task.CompletedTask;
    }
}
