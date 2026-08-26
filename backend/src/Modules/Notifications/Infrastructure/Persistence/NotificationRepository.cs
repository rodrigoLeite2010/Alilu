using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Notifications.Application;
using Alilu.Modules.Notifications.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Notifications.Infrastructure.Persistence;

/// <summary>Implementação de <see cref="INotificationRepository"/> usando o <see cref="AliluDbContext"/> compartilhado (raiz).</summary>
public sealed class NotificationRepository(AliluDbContext dbContext) : INotificationRepository
{
    public Task<Notification?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<Notification>().FirstOrDefaultAsync(n => n.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Notification>> ListByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<Notification>()
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Notification>> ListUnreadByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        await dbContext.Set<Notification>()
            .Where(n => n.UserId == userId && n.ReadAt == null)
            .ToListAsync(cancellationToken);

    public Task<int> CountUnreadByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        dbContext.Set<Notification>().CountAsync(n => n.UserId == userId && n.ReadAt == null, cancellationToken);

    public Task<bool> ExistsAsync(Guid userId, NotificationType type, Guid referenceId, CancellationToken cancellationToken = default) =>
        dbContext.Set<Notification>()
            .AnyAsync(n => n.UserId == userId && n.Type == type && n.ReferenceId == referenceId, cancellationToken);

    public async Task AddAsync(Notification notification, CancellationToken cancellationToken = default) =>
        await dbContext.Set<Notification>().AddAsync(notification, cancellationToken);
}
