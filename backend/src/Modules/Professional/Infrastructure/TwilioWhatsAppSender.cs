using Alilu.Modules.Professional.Application;
using Microsoft.Extensions.Logging;

namespace Alilu.Modules.Professional.Infrastructure;

/// <summary>
/// Implementação de <see cref="IWhatsAppMessageSender"/> via a Twilio
/// WhatsApp Business API — usa o MESMO endpoint da Programmable Messaging
/// API que <see cref="TwilioSmsSender"/>, só com o prefixo <c>"whatsapp:"</c>
/// em origem/destino (convenção da própria Twilio para diferenciar o
/// canal). Registrado só quando <c>Twilio:AccountSid</c>/<c>AuthToken</c>/
/// <c>WhatsAppFrom</c> estão configurados — ver
/// <c>DependencyInjection.AddProfessionalModule</c>; nesta etapa, o
/// template da mensagem precisa estar pré-aprovado pela Meta no Console da
/// Twilio (passo manual fora daqui, ver plano da Etapa 23) para mensagens
/// iniciadas pela empresa (não é resposta a uma mensagem do usuário).
/// </summary>
public sealed class TwilioWhatsAppSender(
    IHttpClientFactory httpClientFactory,
    string accountSid,
    string authToken,
    string whatsAppFromNumber,
    ILogger<TwilioWhatsAppSender> logger) : IWhatsAppMessageSender
{
    public Task<bool> SendAsync(string phoneNumber, string message, CancellationToken cancellationToken = default) =>
        TwilioMessagingClient.SendAsync(
            httpClientFactory.CreateClient("Twilio"),
            accountSid,
            authToken,
            $"whatsapp:{whatsAppFromNumber}",
            $"whatsapp:{phoneNumber}",
            message,
            logger,
            cancellationToken);
}
