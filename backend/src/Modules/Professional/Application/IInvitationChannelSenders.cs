namespace Alilu.Modules.Professional.Application;

/// <summary>
/// Portas de envio dos três canais do convite (Etapa 23 — "a pessoa
/// recebe msg whatsapp e email"; SMS é o FALLBACK do WhatsApp, ver
/// comentário de design em <c>ProfessionalInvitationService.InviteAsync</c>).
/// Implementadas na Infrastructure (Twilio WhatsApp Business API/
/// Programmable Messaging, Twilio SendGrid) — quando as credenciais
/// (<c>Twilio:AccountSid</c>/<c>AuthToken</c>/... , <c>SendGrid:ApiKey</c>)
/// não estão configuradas, a Infrastructure registra em vez disso um
/// sender "fake" que só loga a mensagem (mesmo espírito documentado no
/// plano da Etapa 23: "o código pode ser escrito e testado com um sender
/// fake enquanto a conta Twilio não estiver pronta") — a decisão de qual
/// implementação usar é só de <c>DependencyInjection.AddProfessionalModule</c>,
/// nenhuma delas é do conhecimento da Application.
///
/// CONTRATO: implementações NUNCA devem lançar — mesma regra de
/// <c>Alilu.Modules.Notifications.Application.IPushNotificationSender</c>.
/// Falha de envio (rede indisponível, credencial inválida, número/e-mail
/// mal formado do ponto de vista do provedor etc.) só deve virar
/// <c>false</c> no retorno — jamais pode derrubar a criação do registro
/// de convite.
/// </summary>
public interface IWhatsAppMessageSender
{
    /// <returns><c>true</c> se o provedor aceitou a mensagem para envio.</returns>
    Task<bool> SendAsync(string phoneNumber, string message, CancellationToken cancellationToken = default);
}

/// <summary>SMS — fallback do WhatsApp (Etapa 23, plano: "usado se o número não tiver WhatsApp ou a mensagem falhar"). Mesmo contrato de <see cref="IWhatsAppMessageSender"/>.</summary>
public interface ISmsMessageSender
{
    Task<bool> SendAsync(string phoneNumber, string message, CancellationToken cancellationToken = default);
}

/// <summary>E-mail — só chamado quando o morador informou um e-mail (opcional). Mesmo contrato de <see cref="IWhatsAppMessageSender"/>.</summary>
public interface IEmailMessageSender
{
    Task<bool> SendAsync(string toEmail, string subject, string body, CancellationToken cancellationToken = default);
}
