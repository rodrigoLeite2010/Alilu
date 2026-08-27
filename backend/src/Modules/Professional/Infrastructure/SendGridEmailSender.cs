using System.Net.Http.Headers;
using System.Net.Http.Json;
using Alilu.Modules.Professional.Application;
using Microsoft.Extensions.Logging;

namespace Alilu.Modules.Professional.Infrastructure;

/// <summary>
/// Implementação de <see cref="IEmailMessageSender"/> via a API HTTP da
/// Twilio SendGrid (<c>POST https://api.sendgrid.com/v3/mail/send</c>) —
/// chamada REST direta, mesmo espírito de <c>ExpoPushNotificationSender</c>
/// (sem SDK novo, ver comentário em <see cref="TwilioMessagingClient"/>).
/// Registrado só quando <c>SendGrid:ApiKey</c>/<c>FromEmail</c> estão
/// configurados — ver <c>DependencyInjection.AddProfessionalModule</c>.
///
/// CONTRATO: nunca lança — mesmo contrato dos demais senders deste módulo.
/// </summary>
public sealed class SendGridEmailSender(
    IHttpClientFactory httpClientFactory,
    string apiKey,
    string fromEmail,
    ILogger<SendGridEmailSender> logger) : IEmailMessageSender
{
    private const string SendGridEndpoint = "https://api.sendgrid.com/v3/mail/send";

    public async Task<bool> SendAsync(string toEmail, string subject, string body, CancellationToken cancellationToken = default)
    {
        try
        {
            var httpClient = httpClientFactory.CreateClient("SendGrid");

            using var request = new HttpRequestMessage(HttpMethod.Post, SendGridEndpoint)
            {
                Content = JsonContent.Create(new SendGridMailRequest(
                    new[] { new SendGridPersonalization(new[] { new SendGridEmailAddress(toEmail) }) },
                    new SendGridEmailAddress(fromEmail),
                    subject,
                    new[] { new SendGridContent("text/plain", body) })),
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

            using var response = await httpClient.SendAsync(request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Falha ao enviar e-mail via SendGrid (status {StatusCode}) para {ToEmail} — o convite já foi gravado normalmente.",
                    response.StatusCode,
                    toEmail);
                return false;
            }

            return true;
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Erro ao enviar e-mail via SendGrid para {ToEmail} — o convite já foi gravado normalmente.", toEmail);
            return false;
        }
    }

    private sealed record SendGridEmailAddress(string Email);

    private sealed record SendGridPersonalization(SendGridEmailAddress[] To);

    private sealed record SendGridContent(string Type, string Value);

    private sealed record SendGridMailRequest(
        SendGridPersonalization[] Personalizations,
        SendGridEmailAddress From,
        string Subject,
        SendGridContent[] Content);
}
