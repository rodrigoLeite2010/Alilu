using Alilu.Modules.Professional.Application;
using Microsoft.Extensions.Logging;

namespace Alilu.Modules.Professional.Infrastructure;

/// <summary>
/// Senders "fake" (log em vez de enviar de verdade) — registrados quando
/// as credenciais correspondentes (<c>Twilio:*</c>/<c>SendGrid:*</c>) NÃO
/// estão configuradas (ver <c>DependencyInjection.AddProfessionalModule</c>),
/// exatamente como o plano da Etapa 23 propôs: "enquanto a conta Twilio
/// não estiver pronta, o código pode ser escrito e testado com um sender
/// fake". Devolvem <c>true</c> (não <c>false</c>) — do ponto de vista do
/// morador que convidou, um ambiente de desenvolvimento sem credenciais
/// configuradas não deveria mostrar o convite como "falhou"; o log é o
/// sinal de que nada foi enviado de verdade.
/// </summary>
public sealed class LoggingWhatsAppSender(ILogger<LoggingWhatsAppSender> logger) : IWhatsAppMessageSender
{
    public Task<bool> SendAsync(string phoneNumber, string message, CancellationToken cancellationToken = default)
    {
        logger.LogInformation(
            "[FAKE — Twilio:AccountSid/AuthToken/WhatsAppFrom não configurados] WhatsApp para {PhoneNumber}: {Message}",
            phoneNumber,
            message);
        return Task.FromResult(true);
    }
}

public sealed class LoggingSmsSender(ILogger<LoggingSmsSender> logger) : ISmsMessageSender
{
    public Task<bool> SendAsync(string phoneNumber, string message, CancellationToken cancellationToken = default)
    {
        logger.LogInformation(
            "[FAKE — Twilio:AccountSid/AuthToken/SmsFrom não configurados] SMS para {PhoneNumber}: {Message}",
            phoneNumber,
            message);
        return Task.FromResult(true);
    }
}

public sealed class LoggingEmailSender(ILogger<LoggingEmailSender> logger) : IEmailMessageSender
{
    public Task<bool> SendAsync(string toEmail, string subject, string body, CancellationToken cancellationToken = default)
    {
        logger.LogInformation(
            "[FAKE — SendGrid:ApiKey/FromEmail não configurados] E-mail para {ToEmail} (assunto: {Subject}): {Body}",
            toEmail,
            subject,
            body);
        return Task.FromResult(true);
    }
}
