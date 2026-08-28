using Alilu.Modules.Professional.Application;
using Microsoft.Extensions.Logging;

namespace Alilu.Modules.Professional.Infrastructure;

/// <summary>
/// Implementação de <see cref="ISmsMessageSender"/> via a Twilio
/// Programmable Messaging API — fallback do WhatsApp (plano da Etapa 23:
/// "usado se o número não tiver WhatsApp ou a mensagem falhar"). Registrado
/// só quando <c>Twilio:AccountSid</c>/<c>AuthToken</c>/<c>SmsFrom</c>
/// estão configurados — ver <c>DependencyInjection.AddProfessionalModule</c>.
/// </summary>
public sealed class TwilioSmsSender(
    IHttpClientFactory httpClientFactory,
    string accountSid,
    string authToken,
    string smsFromNumber,
    ILogger<TwilioSmsSender> logger) : ISmsMessageSender
{
    public Task<bool> SendAsync(string phoneNumber, string message, CancellationToken cancellationToken = default) =>
        TwilioMessagingClient.SendAsync(
            httpClientFactory.CreateClient("Twilio"),
            accountSid,
            authToken,
            smsFromNumber,
            BrazilianPhoneNumberFormatter.ToE164(phoneNumber),
            body: message,
            contentSid: null,
            logger,
            cancellationToken);
}
