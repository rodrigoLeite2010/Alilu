namespace Alilu.Modules.Notifications.Application;

/// <summary>Base de todas as exceções de aplicação deste módulo — mesmo padrão de <c>RecommendationsApplicationException</c> (Etapa 10).</summary>
public abstract class NotificationsApplicationException : Exception
{
    protected NotificationsApplicationException(string message) : base(message)
    {
    }
}

/// <summary>A notificação não existe ou não pertence ao usuário autenticado (mesma segunda camada de defesa de <c>BookingService.GetOwnBookingOrThrowAsync</c>) — 404.</summary>
public sealed class NotificationNotFoundException()
    : NotificationsApplicationException("Notificação não encontrada.");
