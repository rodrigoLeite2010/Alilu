using Alilu.Modules.Professional.Application;
using Microsoft.Extensions.Logging;

namespace Alilu.Modules.Professional.Infrastructure;

/// <summary>
/// Implementação de <see cref="IWhatsAppMessageSender"/> via a Twilio
/// WhatsApp Business API — usa o MESMO endpoint da Programmable Messaging
/// API que <see cref="TwilioSmsSender"/>, só com o prefixo <c>"whatsapp:"</c>
/// em origem/destino (convenção da própria Twilio para diferenciar o
/// canal). Registrado só quando <c>Twilio:AccountSid</c>/<c>AuthToken</c>/
/// <c>WhatsAppFrom</c>/<c>WhatsAppContentSid</c> estão TODOS configurados
/// — ver <c>DependencyInjection.AddProfessionalModule</c>.
///
/// <c>contentSid</c> é obrigatório (não opcional) porque este convite é
/// sempre uma mensagem INICIADA PELA EMPRESA (o prestador convidado nunca
/// mandou mensagem antes) — a Meta só aceita esse tipo de mensagem via um
/// Content Template pré-aprovado no Console da Twilio (Messaging ->
/// Content Template Builder), nunca texto livre (<c>Body</c>). Confirmado
/// por Rodrigo com uma chamada real funcionando (curl com <c>ContentSid</c>,
/// sem <c>Body</c>) — replicado aqui exatamente da mesma forma. Nesta
/// etapa o template usado não tem variável de conteúdo conhecida (a
/// mensagem enviada é 100% a definida no template, cadastrada direto no
/// Console da Twilio) — se um dia precisar personalizar com o nome do
/// condomínio, dá para adicionar um parâmetro <c>ContentVariables</c> (ver
/// skill twilio-content-template-builder) sem quebrar esta assinatura.
/// </summary>
public sealed class TwilioWhatsAppSender(
    IHttpClientFactory httpClientFactory,
    string accountSid,
    string authToken,
    string whatsAppFromNumber,
    string contentSid,
    ILogger<TwilioWhatsAppSender> logger) : IWhatsAppMessageSender
{
    public Task<bool> SendAsync(string phoneNumber, string message, CancellationToken cancellationToken = default) =>
        TwilioMessagingClient.SendAsync(
            httpClientFactory.CreateClient("Twilio"),
            accountSid,
            authToken,
            $"whatsapp:{whatsAppFromNumber}",
            $"whatsapp:{BrazilianPhoneNumberFormatter.ToE164(phoneNumber)}",
            body: null,
            contentSid: contentSid,
            logger,
            cancellationToken);
}
