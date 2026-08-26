namespace Alilu.Modules.Notifications.Application;

/// <summary>
/// CORREÇÃO (Etapa 14, auditoria): este comentário dizia que o módulo não
/// precisava de nenhum mecanismo de concorrência além da checagem em
/// memória — isso estava ERRADO para a REGRA "não enviar notificações
/// duplicadas" (<see cref="NotificationDispatcher.NotifyAsync"/>): a
/// checagem <c>INotificationRepository.ExistsAsync</c> sozinha é um
/// clássico "lê, decide, escreve" — duas chamadas concorrentes de
/// <c>NotifyAsync</c> para o MESMO evento (ex.: <c>BookingReminderBackgroundService</c>
/// disparando o mesmo lembrete duas vezes por uma corrida própria dele)
/// podiam, ambas, ler "não existe" antes de qualquer uma inserir — cada
/// uma inseria a sua, violando a regra sem que o índice em banco (que era
/// só um índice comum, não único) nem detectasse. Diferente do caso do
/// módulo Scheduling/Recommendations (onde a corrida coloca em risco algo
/// que exige uma decisão nova — que horário vence, se o teto foi
/// realmente atingido), aqui a decisão correta diante da corrida é
/// simples e sempre a mesma: a notificação já existe, então a "perdedora"
/// não deve fazer nada — não é um erro para o chamador ver.
/// </summary>
public interface IUnitOfWork
{
    Task SaveChangesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Como <see cref="SaveChangesAsync"/>, mas trata uma violação do
    /// índice único (UserId, Type, ReferenceId) — ver
    /// <c>Alilu.Modules.Notifications.Infrastructure.Persistence.NotificationConfiguration</c>
    /// — como sucesso silencioso (idempotente) em vez de propagar a
    /// exceção do driver: a "perdedora" da corrida só não persiste uma
    /// segunda notificação, sem que isso vire um erro 500 para quem
    /// chamou <see cref="NotificationDispatcher.NotifyAsync"/> (que, em
    /// muitos casos, já é uma chamada de efeito colateral no meio de uma
    /// requisição HTTP que, sem isso, já teria tido sucesso — ex.:
    /// <c>BookingsController.Create</c> já criou o agendamento antes de
    /// notificar o profissional).
    /// </summary>
    /// <returns><c>true</c> se a notificação foi persistida; <c>false</c> se já existia (duplicata detectada só no banco, pela corrida acima).</returns>
    Task<bool> SaveChangesOrIgnoreDuplicateAsync(CancellationToken cancellationToken = default);
}
