using Alilu.Modules.Notifications.Application;
using Alilu.Modules.Notifications.Domain;

namespace Alilu.Modules.Notifications.Application.Tests.TestDoubles;

/// <summary>Fake de <see cref="IPushNotificationSender"/> — só registra as chamadas, nunca faz rede de verdade (mesmo espírito do sandbox de build, mas aqui é uma escolha de design do teste, não uma limitação).</summary>
public sealed class FakePushNotificationSender : IPushNotificationSender
{
    private readonly List<(string Token, string Title, string Message, NotificationType Type, Guid? ReferenceId)> _sent = new();

    public IReadOnlyList<(string Token, string Title, string Message, NotificationType Type, Guid? ReferenceId)> Sent => _sent;

    public Task SendAsync(
        string expoPushToken,
        string title,
        string message,
        NotificationType type,
        Guid? referenceId,
        CancellationToken cancellationToken = default)
    {
        _sent.Add((expoPushToken, title, message, type, referenceId));
        return Task.CompletedTask;
    }
}
