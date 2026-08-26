namespace Alilu.Modules.Notifications.Application;

/// <summary>
/// Casos de uso self-service (qualquer usuário autenticado, sempre
/// restrito ao próprio usuário) — React Native: NotificationCenter.
/// Criar notificações NÃO é responsabilidade desta interface — ver
/// <see cref="INotificationDispatcher"/>, o ponto de extensão usado pelos
/// demais módulos (via Api).
/// </summary>
public interface INotificationService
{
    /// <summary>React Native: NotificationCenter — "minhas notificações".</summary>
    Task<IReadOnlyList<NotificationResponse>> ListMyNotificationsAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>React Native: NotificationBadge.</summary>
    Task<int> GetMyUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>React Native: NotificationItem — ao abrir uma notificação. Lança <see cref="NotificationNotFoundException"/> quando não existe ou não é do usuário.</summary>
    Task<NotificationResponse> MarkAsReadAsync(Guid userId, Guid notificationId, CancellationToken cancellationToken = default);

    /// <summary>React Native: NotificationCenter — "marcar todas como lidas".</summary>
    Task MarkAllAsReadAsync(Guid userId, CancellationToken cancellationToken = default);
}
