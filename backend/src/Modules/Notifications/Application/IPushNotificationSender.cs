using Alilu.Modules.Notifications.Domain;

namespace Alilu.Modules.Notifications.Application;

/// <summary>
/// Envio de Push Notification para um token de dispositivo (Expo — "React
/// Native: Utilizar Expo Notifications"). Implementado na Infrastructure
/// (<c>ExpoPushNotificationSender</c>, chamada HTTP à API de push do Expo).
///
/// <paramref name="type"/>/<paramref name="referenceId"/> vão no campo
/// <c>data</c> do payload do Expo (nunca no texto visível) — é o que
/// permite ao app resolver a tela correspondente ("ao clicar na
/// notificação, abrir a tela correspondente") mesmo quando o toque
/// acontece numa notificação do sistema (app em background/fechado), sem
/// precisar antes buscar a lista de notificações — ver
/// <c>services/notifications.ts#addNotificationResponseListener</c> e
/// <c>modules/notifications/notificationRouting.ts</c> no mobile.
///
/// CONTRATO: implementações NUNCA devem lançar. Falha de envio (rede
/// indisponível, token inválido/expirado etc.) é só uma degradação
/// silenciosa da experiência de push — jamais pode derrubar a ação de
/// negócio que originou a notificação (ex.: criar um agendamento não pode
/// falhar porque o Expo está fora do ar). Ver <see cref="NotificationDispatcher"/>.
/// </summary>
public interface IPushNotificationSender
{
    Task SendAsync(
        string expoPushToken,
        string title,
        string message,
        NotificationType type,
        Guid? referenceId,
        CancellationToken cancellationToken = default);
}
