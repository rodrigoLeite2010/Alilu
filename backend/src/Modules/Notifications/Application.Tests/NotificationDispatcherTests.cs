using Alilu.Modules.Notifications.Domain;
using Xunit;

namespace Alilu.Modules.Notifications.Application.Tests;

/// <summary>
/// Cobre <see cref="NotificationDispatcher"/> — o ponto de extensão único
/// usado pela Api para criar notificações (PROMPT 11). REGRA "não enviar
/// notificações duplicadas" é o foco principal aqui.
/// </summary>
public sealed class NotificationDispatcherTests
{
    [Fact]
    public async Task NotifyAsync_FirstCall_CreatesNotificationAndSendsPush()
    {
        var fixture = new NotificationServiceTestFixture();
        var sut = fixture.CreateDispatcherSut();
        var userId = Guid.NewGuid();
        var referenceId = Guid.NewGuid();
        await fixture.DeviceTokenRepository.AddAsync(DeviceToken.Register(userId, "ExponentPushToken[abc]"));

        await sut.NotifyAsync(userId, NotificationType.BookingCreated, "Título", "Mensagem", referenceId);

        var notification = Assert.Single(fixture.NotificationRepository.Notifications);
        Assert.Equal(userId, notification.UserId);
        Assert.Equal(NotificationType.BookingCreated, notification.Type);
        Assert.False(notification.IsRead);
        var sentPush = Assert.Single(fixture.PushNotificationSender.Sent);
        Assert.Equal("ExponentPushToken[abc]", sentPush.Token);
    }

    [Fact]
    public async Task NotifyAsync_NoDeviceToken_StillCreatesNotificationWithoutSendingPush()
    {
        var fixture = new NotificationServiceTestFixture();
        var sut = fixture.CreateDispatcherSut();

        await sut.NotifyAsync(Guid.NewGuid(), NotificationType.NewReview, "Título", "Mensagem", Guid.NewGuid());

        Assert.Single(fixture.NotificationRepository.Notifications);
        Assert.Empty(fixture.PushNotificationSender.Sent);
    }

    [Fact]
    public async Task NotifyAsync_SameUserTypeAndReference_DoesNotDuplicate()
    {
        // REGRA "não enviar notificações duplicadas" — o cenário real é o
        // BookingReminderBackgroundService rodando várias vezes antes do
        // horário do agendamento chegar.
        var fixture = new NotificationServiceTestFixture();
        var sut = fixture.CreateDispatcherSut();
        var userId = Guid.NewGuid();
        var referenceId = Guid.NewGuid();

        await sut.NotifyAsync(userId, NotificationType.ServiceReminder, "Lembrete", "Mensagem 1", referenceId);
        await sut.NotifyAsync(userId, NotificationType.ServiceReminder, "Lembrete", "Mensagem 2", referenceId);

        Assert.Single(fixture.NotificationRepository.Notifications);
    }

    [Fact]
    public async Task NotifyAsync_SameReferenceDifferentType_CreatesBoth()
    {
        // Dedup é por UserId+Type+ReferenceId — um mesmo Booking pode gerar
        // BookingCreated e, depois, BookingAccepted, sem um suprimir o outro.
        var fixture = new NotificationServiceTestFixture();
        var sut = fixture.CreateDispatcherSut();
        var userId = Guid.NewGuid();
        var referenceId = Guid.NewGuid();

        await sut.NotifyAsync(userId, NotificationType.BookingCreated, "Novo", "Mensagem", referenceId);
        await sut.NotifyAsync(userId, NotificationType.BookingAccepted, "Aceito", "Mensagem", referenceId);

        Assert.Equal(2, fixture.NotificationRepository.Notifications.Count);
    }

    [Fact]
    public async Task NotifyAsync_SameTypeAndReferenceDifferentUser_CreatesBoth()
    {
        // Dedup nunca cruza usuários — o mesmo Booking gera uma notificação
        // para o morador e outra para o profissional.
        var fixture = new NotificationServiceTestFixture();
        var sut = fixture.CreateDispatcherSut();
        var referenceId = Guid.NewGuid();

        await sut.NotifyAsync(Guid.NewGuid(), NotificationType.ServiceReminder, "Lembrete", "Mensagem", referenceId);
        await sut.NotifyAsync(Guid.NewGuid(), NotificationType.ServiceReminder, "Lembrete", "Mensagem", referenceId);

        Assert.Equal(2, fixture.NotificationRepository.Notifications.Count);
    }
}
