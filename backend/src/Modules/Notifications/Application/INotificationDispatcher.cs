using Alilu.Modules.Notifications.Domain;

namespace Alilu.Modules.Notifications.Application;

/// <summary>
/// Ponto de extensão central para os demais módulos criarem notificações
/// (PROMPT 11) — mesmo papel de <c>IBookingService.ValidateCompletedBookingForReviewAsync</c>
/// (Etapa 09) e <c>IMembershipService.GetMyActiveMembershipAsync</c> (Etapa
/// 10): nenhum módulo pode referenciar Notifications (nem o contrário —
/// PROMPT 01), então é a Api (composição raiz) quem chama isto DEPOIS da
/// ação principal de cada módulo — nunca antes, e nunca dentro da
/// transação da ação principal (ver ARCHITECTURE.md, "Etapa 11 —
/// composição").
///
/// Garante sozinho as duas REGRAS que se aplicam a toda notificação criada
/// por qualquer módulo:
///
/// 1. "Não enviar notificações duplicadas" — mesmo UserId+Type+ReferenceId
///    nunca gera uma segunda linha (ver <see cref="INotificationRepository.ExistsAsync"/>).
/// 2. Dispara a Push Notification, best-effort, via
///    <see cref="IPushNotificationSender"/> — uma falha de push nunca
///    derruba a chamada (ver contrato da interface).
///
/// "Não expor informações sensíveis na notificação" é responsabilidade de
/// QUEM CHAMA (a Api já deve montar <paramref name="title"/>/
/// <paramref name="message"/> como texto seguro para exibição) — este
/// método não sanitiza nada, só grava e envia o que recebeu.
/// </summary>
public interface INotificationDispatcher
{
    Task NotifyAsync(
        Guid userId,
        NotificationType type,
        string title,
        string message,
        Guid? referenceId,
        CancellationToken cancellationToken = default);
}
