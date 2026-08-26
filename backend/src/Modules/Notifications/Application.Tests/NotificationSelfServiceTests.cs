using Alilu.Modules.Notifications.Domain;
using Xunit;

namespace Alilu.Modules.Notifications.Application.Tests;

/// <summary>Cobre <see cref="NotificationService"/> — "minhas notificações", contagem não lida, marcar como lida (React Native: NotificationCenter/NotificationItem/NotificationBadge).</summary>
public sealed class NotificationSelfServiceTests
{
    [Fact]
    public async Task ListMyNotificationsAsync_ReturnsOnlyOwnNotifications()
    {
        var fixture = new NotificationServiceTestFixture();
        var dispatcher = fixture.CreateDispatcherSut();
        var sut = fixture.CreateSelfServiceSut();
        var userId = Guid.NewGuid();
        await dispatcher.NotifyAsync(userId, NotificationType.NewReview, "T", "M", Guid.NewGuid());
        await dispatcher.NotifyAsync(Guid.NewGuid(), NotificationType.NewReview, "T", "M", Guid.NewGuid());

        var mine = await sut.ListMyNotificationsAsync(userId);

        var only = Assert.Single(mine);
        Assert.Equal(userId, only.UserId);
    }

    [Fact]
    public async Task GetMyUnreadCountAsync_CountsOnlyUnread()
    {
        var fixture = new NotificationServiceTestFixture();
        var dispatcher = fixture.CreateDispatcherSut();
        var sut = fixture.CreateSelfServiceSut();
        var userId = Guid.NewGuid();
        await dispatcher.NotifyAsync(userId, NotificationType.NewReview, "T", "M1", Guid.NewGuid());
        await dispatcher.NotifyAsync(userId, NotificationType.NewReview, "T", "M2", Guid.NewGuid());
        var second = fixture.NotificationRepository.Notifications.Single(n => n.Message == "M2");

        await sut.MarkAsReadAsync(userId, second.Id);

        Assert.Equal(1, await sut.GetMyUnreadCountAsync(userId));
    }

    [Fact]
    public async Task MarkAsReadAsync_OtherUsersNotification_ThrowsNotFound()
    {
        var fixture = new NotificationServiceTestFixture();
        var dispatcher = fixture.CreateDispatcherSut();
        var sut = fixture.CreateSelfServiceSut();
        var ownerId = Guid.NewGuid();
        await dispatcher.NotifyAsync(ownerId, NotificationType.NewReview, "T", "M", Guid.NewGuid());
        var notification = Assert.Single(fixture.NotificationRepository.Notifications);

        await Assert.ThrowsAsync<NotificationNotFoundException>(
            () => sut.MarkAsReadAsync(Guid.NewGuid(), notification.Id));
    }

    [Fact]
    public async Task MarkAsReadAsync_UnknownId_ThrowsNotFound()
    {
        var fixture = new NotificationServiceTestFixture();
        var sut = fixture.CreateSelfServiceSut();

        await Assert.ThrowsAsync<NotificationNotFoundException>(
            () => sut.MarkAsReadAsync(Guid.NewGuid(), Guid.NewGuid()));
    }

    [Fact]
    public async Task MarkAsReadAsync_Twice_IsIdempotent()
    {
        var fixture = new NotificationServiceTestFixture();
        var dispatcher = fixture.CreateDispatcherSut();
        var sut = fixture.CreateSelfServiceSut();
        var userId = Guid.NewGuid();
        await dispatcher.NotifyAsync(userId, NotificationType.NewReview, "T", "M", Guid.NewGuid());
        var notification = Assert.Single(fixture.NotificationRepository.Notifications);

        var firstRead = await sut.MarkAsReadAsync(userId, notification.Id);
        var secondRead = await sut.MarkAsReadAsync(userId, notification.Id);

        Assert.Equal(firstRead.ReadAt, secondRead.ReadAt);
    }

    [Fact]
    public async Task MarkAllAsReadAsync_MarksEveryUnreadNotificationOfThatUser()
    {
        var fixture = new NotificationServiceTestFixture();
        var dispatcher = fixture.CreateDispatcherSut();
        var sut = fixture.CreateSelfServiceSut();
        var userId = Guid.NewGuid();
        await dispatcher.NotifyAsync(userId, NotificationType.NewReview, "T", "M1", Guid.NewGuid());
        await dispatcher.NotifyAsync(userId, NotificationType.NewReview, "T", "M2", Guid.NewGuid());
        await dispatcher.NotifyAsync(Guid.NewGuid(), NotificationType.NewReview, "T", "M3", Guid.NewGuid());

        await sut.MarkAllAsReadAsync(userId);

        Assert.Equal(0, await sut.GetMyUnreadCountAsync(userId));
        Assert.True(fixture.NotificationRepository.Notifications.Single(n => n.Message == "M3").ReadAt is null);
    }
}
