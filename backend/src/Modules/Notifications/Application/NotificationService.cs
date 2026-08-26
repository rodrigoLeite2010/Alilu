using Alilu.Modules.Notifications.Domain;

namespace Alilu.Modules.Notifications.Application;

/// <summary>Implementação de <see cref="INotificationService"/> — ver comentário de design lá.</summary>
public sealed class NotificationService(
    INotificationRepository notificationRepository,
    IUnitOfWork unitOfWork) : INotificationService
{
    public async Task<IReadOnlyList<NotificationResponse>> ListMyNotificationsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var notifications = await notificationRepository.ListByUserIdAsync(userId, cancellationToken);
        return notifications.Select(NotificationMapper.ToResponse).ToList();
    }

    public Task<int> GetMyUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default) =>
        notificationRepository.CountUnreadByUserIdAsync(userId, cancellationToken);

    public async Task<NotificationResponse> MarkAsReadAsync(Guid userId, Guid notificationId, CancellationToken cancellationToken = default)
    {
        var notification = await GetOwnNotificationOrThrowAsync(userId, notificationId, cancellationToken);

        notification.MarkAsRead();
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return NotificationMapper.ToResponse(notification);
    }

    public async Task MarkAllAsReadAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var unread = await notificationRepository.ListUnreadByUserIdAsync(userId, cancellationToken);
        if (unread.Count == 0)
        {
            return;
        }

        foreach (var notification in unread)
        {
            notification.MarkAsRead();
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task<Notification> GetOwnNotificationOrThrowAsync(Guid userId, Guid notificationId, CancellationToken cancellationToken)
    {
        var notification = await notificationRepository.GetByIdAsync(notificationId, cancellationToken)
            ?? throw new NotificationNotFoundException();

        // Segunda camada de defesa: uma notificação só pode ser vista/lida
        // pelo próprio destinatário — mesmo padrão de
        // BookingService.GetOwnBookingOrThrowAsync.
        if (notification.UserId != userId)
        {
            throw new NotificationNotFoundException();
        }

        return notification;
    }
}
