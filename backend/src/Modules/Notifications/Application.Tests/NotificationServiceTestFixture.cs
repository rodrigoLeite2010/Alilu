using Alilu.Modules.Notifications.Application.Tests.TestDoubles;

namespace Alilu.Modules.Notifications.Application.Tests;

/// <summary>Monta <see cref="NotificationService"/>/<see cref="NotificationDispatcher"/>/<see cref="DeviceTokenService"/> reais com dependências fake (em memória) — mesmo espírito de RecommendationServiceTestFixture.</summary>
internal sealed class NotificationServiceTestFixture
{
    public InMemoryNotificationRepository NotificationRepository { get; } = new();
    public InMemoryDeviceTokenRepository DeviceTokenRepository { get; } = new();
    public FakePushNotificationSender PushNotificationSender { get; } = new();

    public NotificationService CreateSelfServiceSut() => new(NotificationRepository, new FakeUnitOfWork());

    public NotificationDispatcher CreateDispatcherSut() =>
        new(NotificationRepository, DeviceTokenRepository, new FakeUnitOfWork(), PushNotificationSender);

    public DeviceTokenService CreateDeviceTokenSut() => new(DeviceTokenRepository, new FakeUnitOfWork());
}
