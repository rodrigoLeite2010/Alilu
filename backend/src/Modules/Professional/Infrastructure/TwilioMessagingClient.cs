using System.Net.Http.Headers;
using System.Text;
using Microsoft.Extensions.Logging;

namespace Alilu.Modules.Professional.Infrastructure;

/// <summary>
/// Chamada HTTP crua compartilhada por <see cref="TwilioWhatsAppSender"/> e
/// <see cref="TwilioSmsSender"/> — ambos usam exatamente o mesmo endpoint
/// da Twilio Programmable Messaging API (<c>POST .../Messages.json</c>),
/// só o prefixo "whatsapp:" (WhatsApp Business API) e o número de origem
/// mudam. Ver <c>ExpoPushNotificationSender</c> (módulo Notifications,
/// Etapa 11) para o mesmo espírito de "chamada HTTP crua em vez de SDK" —
/// aqui pelo mesmo motivo (este sandbox não tem acesso a NuGet.org para
/// restaurar um SDK novo; a Api real do desenvolvedor não tem essa
/// restrição, mas a chamada REST direta funciona igual em ambos).
///
/// CONTRATO: nunca lança — qualquer falha (rede, credencial inválida,
/// número rejeitado pela Twilio) só loga e devolve <c>false</c>, mesmo
/// contrato de <see cref="Alilu.Modules.Professional.Application.IWhatsAppMessageSender"/>/
/// <see cref="Alilu.Modules.Professional.Application.ISmsMessageSender"/>.
///
/// LIMITAÇÃO DO SANDBOX (Claude): este container de build não tem acesso à
/// internet, então esta classe nunca foi (nem poderia ser) exercitada
/// contra a API real da Twilio aqui — mesma limitação já documentada em
/// <c>ExpoPushNotificationSender</c>.
/// </summary>
internal static class TwilioMessagingClient
{
    private const string MessagesEndpointFormat = "https://api.twilio.com/2010-04-01/Accounts/{0}/Messages.json";

    public static async Task<bool> SendAsync(
        HttpClient httpClient,
        string accountSid,
        string authToken,
        string fromNumber,
        string toNumber,
        string body,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, string.Format(MessagesEndpointFormat, accountSid))
            {
                Content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["To"] = toNumber,
                    ["From"] = fromNumber,
                    ["Body"] = body,
                }),
            };

            var basicAuthValue = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{accountSid}:{authToken}"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", basicAuthValue);

            using var response = await httpClient.SendAsync(request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Falha ao enviar mensagem via Twilio (status {StatusCode}) para {ToNumber} — o convite já foi gravado normalmente.",
                    response.StatusCode,
                    toNumber);
                return false;
            }

            return true;
        }
        catch (Exception exception)
        {
            // Contrato dos senders deste módulo: nunca propagar. Uma
            // instabilidade da Twilio não pode derrubar a criação do
            // convite.
            logger.LogWarning(exception, "Erro ao enviar mensagem via Twilio para {ToNumber} — o convite já foi gravado normalmente.", toNumber);
            return false;
        }
    }
}
