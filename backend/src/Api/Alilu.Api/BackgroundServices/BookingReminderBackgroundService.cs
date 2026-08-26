using Alilu.Modules.Notifications.Application;
using Alilu.Modules.Notifications.Domain;
using Alilu.Modules.Professional.Application;
using Alilu.Modules.Scheduling.Application;

namespace Alilu.Api.BackgroundServices;

/// <summary>
/// EVENTO "lembrete do serviço" (PROMPT 11). Diferente dos outros nove
/// EVENTOS, este não nasce de uma ação de um usuário — é a Api quem
/// decide, periodicamente, quando um agendamento confirmado está "perto o
/// bastante" para merecer um lembrete. Por isso vive aqui (Api, composição
/// raiz) como um <see cref="BackgroundService"/>, e não como um endpoint:
/// nenhum dos módulos envolvidos (Scheduling/Professional/Notifications)
/// pode referenciar os outros (PROMPT 01), então só a Api enxerga os três
/// ao mesmo tempo, exatamente como já acontece em qualquer controller de
/// composição (ex.: <c>BookingsController</c>).
///
/// Usa <see cref="IBookingService.ListConfirmedBookingsByDateRangeAsync"/>
/// (extensão mínima adicionada ao módulo Scheduling nesta etapa) para
/// listar os agendamentos Confirmed de hoje/amanhã, e considera "devido"
/// todo agendamento cujo início cai dentro de <see cref="ReminderWindow"/>
/// a partir de agora. <c>ScheduledDate</c>/<c>StartTime</c> são tratados
/// como horário local sem fuso embutido — mesma decisão já documentada no
/// módulo Professional (Etapa 07) — comparados aqui diretamente contra
/// <see cref="DateTime.UtcNow"/> por simplicidade (MVP; ver
/// ARCHITECTURE.md, "Etapa 11", para a decisão de escopo completa).
///
/// REGRA "não enviar notificações duplicadas" continua garantida pelo
/// mesmo mecanismo central (<see cref="INotificationDispatcher.NotifyAsync"/>)
/// — mesmo que este processo rode várias vezes antes do horário chegar,
/// cada usuário recebe o lembrete de um agendamento só uma vez.
/// </summary>
public sealed class BookingReminderBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<BookingReminderBackgroundService> logger) : BackgroundService
{
    private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan ReminderWindow = TimeSpan.FromHours(24);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(CheckInterval);

        do
        {
            try
            {
                await SendDueRemindersAsync(stoppingToken);
            }
            catch (Exception exception)
            {
                // Uma rodada com falha (ex.: banco momentaneamente
                // indisponível) nunca deve derrubar o processo de fundo
                // inteiro — a próxima rodada tenta de novo.
                logger.LogWarning(exception, "Falha ao processar lembretes de serviço.");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task SendDueRemindersAsync(CancellationToken cancellationToken)
    {
        // BackgroundService é singleton; IBookingService/AliluDbContext são
        // scoped — precisa do próprio escopo a cada rodada, mesmo padrão
        // recomendado pela documentação do ASP.NET Core para trabalho de
        // fundo que usa serviços scoped.
        using var scope = scopeFactory.CreateScope();
        var bookingService = scope.ServiceProvider.GetRequiredService<IBookingService>();
        var professionalDirectoryService = scope.ServiceProvider.GetRequiredService<IProfessionalDirectoryService>();
        var notificationDispatcher = scope.ServiceProvider.GetRequiredService<INotificationDispatcher>();

        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var tomorrow = today.AddDays(1);

        var upcoming = await bookingService.ListConfirmedBookingsByDateRangeAsync(today, tomorrow, cancellationToken);

        foreach (var booking in upcoming)
        {
            var scheduledAt = booking.ScheduledDate.ToDateTime(booking.StartTime);
            var untilStart = scheduledAt - now;

            if (untilStart < TimeSpan.Zero || untilStart > ReminderWindow)
            {
                continue;
            }

            const string title = "Lembrete de serviço";
            var message = $"Você tem um serviço agendado para {booking.ScheduledDate:dd/MM/yyyy} às {booking.StartTime:HH:mm}.";

            // Um lembrete para cada lado do agendamento.
            await notificationDispatcher.NotifyAsync(
                booking.ResidentId, NotificationType.ServiceReminder, title, message, booking.Id, cancellationToken);

            try
            {
                var professionalUserId = await professionalDirectoryService.GetProfessionalUserIdAsync(booking.ProfessionalId, cancellationToken);
                await notificationDispatcher.NotifyAsync(
                    professionalUserId, NotificationType.ServiceReminder, title, message, booking.Id, cancellationToken);
            }
            catch (ProfessionalNotFoundException)
            {
                // Perfil desativado depois do agendamento ter sido
                // confirmado — não impede o lembrete do morador, já
                // enviado acima.
            }
        }
    }
}
