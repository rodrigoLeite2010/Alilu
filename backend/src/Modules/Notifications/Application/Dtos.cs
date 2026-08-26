using Alilu.Modules.Notifications.Domain;

namespace Alilu.Modules.Notifications.Application;

/// <summary>React Native: NotificationCenter/NotificationItem. Nunca inclui dados de outro módulo além do que a própria <see cref="Domain.Notification"/> guarda — Title/Message já chegam prontos para exibição (ver <see cref="INotificationDispatcher"/>).</summary>
public sealed record NotificationResponse(
    Guid Id,
    Guid UserId,
    string Title,
    string Message,
    NotificationType Type,
    Guid? ReferenceId,
    DateTime? ReadAt,
    DateTime CreatedAt,
    bool IsRead);
