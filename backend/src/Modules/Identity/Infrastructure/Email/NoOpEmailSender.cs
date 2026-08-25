using Alilu.Modules.Identity.Application;
using Microsoft.Extensions.Logging;

namespace Alilu.Modules.Identity.Infrastructure.Email;

/// <summary>
/// Implementação "no-op" de <see cref="IEmailSender"/>: apenas registra em
/// log que um e-mail seria enviado, sem enviar nada de verdade.
///
/// PROMPT 03 pede para "preparar recuperação de senha, mas não implementar
/// envio de e-mail ainda" — esta classe é essa preparação: a porta
/// (<see cref="IEmailSender"/>) e um adapter válido para satisfazer a
/// injeção de dependência hoje. Um provedor real (SMTP, SendGrid, SES...)
/// substitui esta classe em uma etapa futura, sem tocar em Application.
/// </summary>
public sealed class NoOpEmailSender(ILogger<NoOpEmailSender> logger) : IEmailSender
{
    public Task SendAsync(string toEmail, string subject, string body, CancellationToken cancellationToken = default)
    {
        logger.LogInformation(
            "[NoOpEmailSender] Envio de e-mail ainda não implementado — nada foi enviado. Para: {ToEmail} | Assunto: {Subject}",
            toEmail,
            subject);

        return Task.CompletedTask;
    }
}
