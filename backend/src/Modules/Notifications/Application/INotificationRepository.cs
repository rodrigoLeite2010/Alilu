using Alilu.Modules.Notifications.Domain;

namespace Alilu.Modules.Notifications.Application;

/// <summary>Porta de persistência de <see cref="Notification"/>.</summary>
public interface INotificationRepository
{
    Task<Notification?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>React Native: NotificationCenter — "minhas notificações", mais recente primeiro.</summary>
    Task<IReadOnlyList<Notification>> ListByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Usado por <c>NotificationService.MarkAllAsReadAsync</c>.</summary>
    Task<IReadOnlyList<Notification>> ListUnreadByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>React Native: NotificationBadge — a contagem exibida no sino.</summary>
    Task<int> CountUnreadByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// REGRA "não enviar notificações duplicadas": <see cref="NotificationDispatcher"/>
    /// chama isto ANTES de criar qualquer notificação — mesmo
    /// UserId+Type+ReferenceId nunca gera uma segunda linha.
    /// </summary>
    Task<bool> ExistsAsync(Guid userId, NotificationType type, Guid referenceId, CancellationToken cancellationToken = default);

    Task AddAsync(Notification notification, CancellationToken cancellationToken = default);
}
