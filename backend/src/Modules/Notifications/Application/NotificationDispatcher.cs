using Alilu.Modules.Notifications.Domain;

namespace Alilu.Modules.Notifications.Application;

/// <summary>Implementação de <see cref="INotificationDispatcher"/> — ver comentário de design lá.</summary>
public sealed class NotificationDispatcher(
    INotificationRepository notificationRepository,
    IDeviceTokenRepository deviceTokenRepository,
    IUnitOfWork unitOfWork,
    IPushNotificationSender pushNotificationSender) : INotificationDispatcher
{
    public async Task NotifyAsync(
        Guid userId,
        NotificationType type,
        string title,
        string message,
        Guid? referenceId,
        CancellationToken cancellationToken = default)
    {
        // REGRA "não enviar notificações duplicadas": nenhum dos dez
        // EVENTOS desta etapa chama NotifyAsync sem ReferenceId, então a
        // checagem abaixo cobre todos os casos reais — ver nota em
        // Notification.cs sobre ReferenceId nulo ficar em aberto para um
        // tipo de notificação futuro sem entidade associada.
        if (referenceId is { } id && await notificationRepository.ExistsAsync(userId, type, id, cancellationToken))
        {
            return;
        }

        var notification = Notification.Create(userId, title, message, type, referenceId);
        await notificationRepository.AddAsync(notification, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        var deviceToken = await deviceTokenRepository.GetByUserIdAsync(userId, cancellationToken);
        if (deviceToken is not null)
        {
            // Best-effort — ver contrato de IPushNotificationSender.SendAsync.
            await pushNotificationSender.SendAsync(deviceToken.Token, title, message, type, referenceId, cancellationToken);
        }
    }
}
