using Alilu.Modules.Notifications.Application;
using Alilu.Modules.Notifications.Domain;

namespace Alilu.Modules.Notifications.Application.Tests.TestDoubles;

/// <summary>Fake em memória de <see cref="INotificationRepository"/>.</summary>
public sealed class InMemoryNotificationRepository : INotificationRepository
{
    private readonly Dictionary<Guid, Notification> _notifications = new();

    public IReadOnlyCollection<Notification> Notifications => _notifications.Values.ToList();

    public Task<Notification?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_notifications.GetValueOrDefault(id));

    public Task<IReadOnlyList<Notification>> ListByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Notification>>(
            _notifications.Values.Where(n => n.UserId == userId).OrderByDescending(n => n.CreatedAt).ToList());

    public Task<IReadOnlyList<Notification>> ListUnreadByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Notification>>(
            _notifications.Values.Where(n => n.UserId == userId && !n.IsRead).ToList());

    public Task<int> CountUnreadByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_notifications.Values.Count(n => n.UserId == userId && !n.IsRead));

    public Task<bool> ExistsAsync(Guid userId, NotificationType type, Guid referenceId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_notifications.Values.Any(n => n.UserId == userId && n.Type == type && n.ReferenceId == referenceId));

    public Task AddAsync(Notification notification, CancellationToken cancellationToken = default)
    {
        _notifications[notification.Id] = notification;
        return Task.CompletedTask;
    }
}
