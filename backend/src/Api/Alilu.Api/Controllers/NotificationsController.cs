using Alilu.Modules.Notifications.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints self-service de notificações (PROMPT 11) — qualquer usuário
/// autenticado pode chamar, sempre restrito ao próprio usuário
/// (<c>User.GetUserId()</c>), mesmo padrão de todos os outros módulos
/// self-service. Nenhum papel especial é exigido — diferente de
/// Recommendations/Resident, este módulo não tem um lado "administrador":
/// notificações são sempre criadas pelos OUTROS módulos (via
/// <c>INotificationDispatcher</c>, chamado pela Api depois da ação
/// principal de cada um — ver <c>BookingsController</c>/
/// <c>ProfessionalBookingsController</c>/<c>ReviewsController</c>/
/// <c>AdminRecommendationsController</c>/<c>AdminMembershipsController</c>
/// e ARCHITECTURE.md, "Etapa 11 — composição"), nunca por este controller.
/// </summary>
[ApiController]
[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController(
    INotificationService notificationService,
    IDeviceTokenService deviceTokenService) : ControllerBase
{
    /// <summary>React Native: NotificationCenter.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NotificationResponse>>> ListMine(CancellationToken cancellationToken)
    {
        var notifications = await notificationService.ListMyNotificationsAsync(User.GetUserId(), cancellationToken);
        return Ok(notifications);
    }

    /// <summary>React Native: NotificationBadge.</summary>
    [HttpGet("unread-count")]
    public async Task<ActionResult<int>> GetUnreadCount(CancellationToken cancellationToken)
    {
        var count = await notificationService.GetMyUnreadCountAsync(User.GetUserId(), cancellationToken);
        return Ok(count);
    }

    /// <summary>React Native: NotificationItem — "ao clicar na notificação" (marca como lida antes/ao abrir a tela correspondente).</summary>
    [HttpPost("{id:guid}/read")]
    public async Task<ActionResult<NotificationResponse>> MarkAsRead(Guid id, CancellationToken cancellationToken)
    {
        var notification = await notificationService.MarkAsReadAsync(User.GetUserId(), id, cancellationToken);
        return Ok(notification);
    }

    /// <summary>React Native: NotificationCenter — "marcar todas como lidas".</summary>
    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllAsRead(CancellationToken cancellationToken)
    {
        await notificationService.MarkAllAsReadAsync(User.GetUserId(), cancellationToken);
        return NoContent();
    }

    /// <summary>React Native: "Configurar device token" — chamado logo após o app obter/renovar o Expo push token.</summary>
    [HttpPost("device-token")]
    public async Task<IActionResult> RegisterDeviceToken([FromBody] RegisterDeviceTokenBody body, CancellationToken cancellationToken)
    {
        await deviceTokenService.RegisterMyTokenAsync(User.GetUserId(), body.Token, cancellationToken);
        return NoContent();
    }

    /// <summary>React Native: logout — para de receber push neste dispositivo.</summary>
    [HttpDelete("device-token")]
    public async Task<IActionResult> RemoveDeviceToken(CancellationToken cancellationToken)
    {
        await deviceTokenService.RemoveMyTokenAsync(User.GetUserId(), cancellationToken);
        return NoContent();
    }
}

/// <summary>Corpo de POST .../notifications/device-token.</summary>
public sealed record RegisterDeviceTokenBody(string Token);
