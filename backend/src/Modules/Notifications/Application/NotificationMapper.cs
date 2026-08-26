using Alilu.Modules.Notifications.Domain;

namespace Alilu.Modules.Notifications.Application;

internal static class NotificationMapper
{
    public static NotificationResponse ToResponse(Notification notification) => new(
        notification.Id,
        notification.UserId,
        notification.Title,
        notification.Message,
        notification.Type,
        notification.ReferenceId,
        notification.ReadAt,
        notification.CreatedAt,
        notification.IsRead);
}
