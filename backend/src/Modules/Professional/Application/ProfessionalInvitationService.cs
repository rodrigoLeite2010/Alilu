using Alilu.Modules.Professional.Domain;

namespace Alilu.Modules.Professional.Application;

/// <summary>Implementação de <see cref="IProfessionalInvitationService"/> — ver comentário de design lá.</summary>
public sealed class ProfessionalInvitationService(
    IProfessionalInvitationRepository invitationRepository,
    IWhatsAppMessageSender whatsAppSender,
    ISmsMessageSender smsSender,
    IEmailMessageSender emailSender,
    IUnitOfWork unitOfWork) : IProfessionalInvitationService
{
    /// <summary>"Limite de envio" (Etapa 23, plano: 10 convites/dia por morador) — ver comentário completo (incluindo a limitação conhecida de corrida) em <see cref="IProfessionalInvitationRepository.CountByInvitedByUserIdSinceAsync"/>.</summary>
    public const int MaxInvitationsPerResidentPerDay = 10;

    public async Task<ProfessionalInvitationResponse> InviteAsync(
        Guid condominiumId,
        Guid invitedByUserId,
        string condominiumName,
        string name,
        string phone,
        string? email,
        CancellationToken cancellationToken = default)
    {
        var pendingCount = await invitationRepository.CountByInvitedByUserIdSinceAsync(
            invitedByUserId, DateTime.UtcNow.AddDays(-1), cancellationToken);

        if (pendingCount >= MaxInvitationsPerResidentPerDay)
        {
            throw new TooManyInvitationsException();
        }

        var invitation = ProfessionalInvitation.Invite(condominiumId, invitedByUserId, name, phone, email);

        var message = BuildInvitationMessage(condominiumName);

        // WhatsApp primeiro; SMS é o FALLBACK (plano da Etapa 23: "usado
        // se o número não tiver WhatsApp ou a mensagem falhar") — só
        // tenta SMS quando o WhatsApp não foi entregue, para não mandar a
        // mesma pessoa duas mensagens de texto quando o WhatsApp já
        // funcionou.
        var whatsAppDelivered = await whatsAppSender.SendAsync(invitation.Phone, message, cancellationToken);
        var smsDelivered = whatsAppDelivered || await smsSender.SendAsync(invitation.Phone, message, cancellationToken);

        bool? emailDelivered = null;
        if (invitation.Email is { } resolvedEmail)
        {
            emailDelivered = await emailSender.SendAsync(resolvedEmail, BuildInvitationEmailSubject(condominiumName), message, cancellationToken);
        }

        invitation.RecordDeliveryResult(whatsAppDelivered, smsDelivered, emailDelivered);

        await invitationRepository.AddAsync(invitation, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ProfessionalMapper.ToResponse(invitation);
    }

    public async Task<IReadOnlyList<ProfessionalInvitationResponse>> ListMyInvitationsAsync(Guid invitedByUserId, CancellationToken cancellationToken = default)
    {
        var invitations = await invitationRepository.ListByInvitedByUserIdAsync(invitedByUserId, cancellationToken);
        return invitations.Select(ProfessionalMapper.ToResponse).ToList();
    }

    /// <summary>
    /// Rascunho de texto do plano da Etapa 23 — "redação final é decisão
    /// de produto", registrado como pendência para Rodrigo no resumo desta
    /// etapa; personalizado só com o nome do condomínio (nenhum dado
    /// sensível do morador que convidou).
    /// </summary>
    private static string BuildInvitationMessage(string condominiumName) =>
        $"Olá! Você foi indicado por um morador do Condomínio {condominiumName} para prestar serviços através do ALILU, " +
        "a plataforma de serviços de confiança do seu condomínio. Baixe o app e cadastre-se para atender esse condomínio.";

    private static string BuildInvitationEmailSubject(string condominiumName) =>
        $"Você foi indicado para prestar serviços no Condomínio {condominiumName} — ALILU";
}
