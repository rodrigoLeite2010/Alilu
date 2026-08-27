using Alilu.Shared;

namespace Alilu.Modules.Professional.Domain;

/// <summary>
/// Etapa 23 (pedido 1 de Rodrigo: "convidar um prestador, o morador
/// coloca o nome, telefone e o email opcional e a pessoa recebe msg
/// whatsapp e email, com o texto para prestadores do condomínio") —
/// convite DIRETO a alguém que ainda não está no ALILU, sem exigir
/// comentário nem aprovação de admin (diferente de
/// <c>Alilu.Modules.Recommendations.Domain.Recommendation</c> em modo
/// "indicação externa", Etapa 10, que É pública/moderada e exige um
/// comentário — aqui o objetivo é só avisar a pessoa e convidá-la a se
/// cadastrar).
///
/// É sua própria raiz de agregado — mesma decisão de todos os módulos:
/// de propósito NÃO há navegação/FK para <c>User</c> (Identity) nem
/// <c>Condominium</c> (Condominium), só os Ids como valores simples. O
/// TEXTO do convite (personalizado com o nome do condomínio) é montado
/// pela Api (composição raiz — este módulo não conhece o nome do
/// condomínio, só o Id) e pelos "senders" da Infrastructure — a entidade
/// só guarda os dados do convite e o RESULTADO do envio por canal.
///
/// <see cref="WhatsAppDelivered"/>/<see cref="SmsDelivered"/>/<see cref="EmailDelivered"/>
/// registram sucesso/falha por canal ("canais enviados com sucesso/falha",
/// pedido de Rodrigo) — <see cref="EmailDelivered"/> é <c>bool?</c> porque
/// <see cref="Email"/> é opcional: nulo significa "e-mail não informado,
/// nenhuma tentativa feita" (diferente de <c>false</c>, que significa
/// "informado, mas a tentativa de envio falhou").
/// </summary>
public sealed class ProfessionalInvitation : AggregateRoot
{
    public const int MaxNameLength = 200;
    public const int MaxPhoneLength = 30;
    public const int MaxEmailLength = 200;

    public Guid CondominiumId { get; private set; }
    public Guid InvitedByUserId { get; private set; }
    public string Name { get; private set; }
    public string Phone { get; private set; }
    public string? Email { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public bool WhatsAppDelivered { get; private set; }
    public bool SmsDelivered { get; private set; }
    public bool? EmailDelivered { get; private set; }

#pragma warning disable CS8618
    private ProfessionalInvitation()
    {
    }
#pragma warning restore CS8618

    private ProfessionalInvitation(
        Guid id,
        Guid condominiumId,
        Guid invitedByUserId,
        string name,
        string phone,
        string? email)
        : base(id)
    {
        CondominiumId = condominiumId;
        InvitedByUserId = invitedByUserId;
        Name = name;
        Phone = phone;
        Email = email;
        CreatedAt = DateTime.UtcNow;
        WhatsAppDelivered = false;
        SmsDelivered = false;
        EmailDelivered = email is null ? null : false;
    }

    /// <summary>
    /// Cria o registro do convite (React Native: tela "Convidar
    /// prestador"). Nasce sem nenhum canal entregue ainda —
    /// <see cref="RecordDeliveryResult"/> é chamado logo depois, já dentro
    /// do mesmo caso de uso (ver <c>ProfessionalInvitationService.InviteAsync</c>),
    /// uma vez que os "senders" (Infrastructure) tenham tentado o envio.
    /// "Morador Active pode convidar" já deve ter sido validado por quem
    /// chama (a Api/Application) — esta entidade, isolada, só valida a
    /// própria consistência interna.
    /// </summary>
    public static ProfessionalInvitation Invite(
        Guid condominiumId,
        Guid invitedByUserId,
        string name,
        string phone,
        string? email)
    {
        if (condominiumId == Guid.Empty)
        {
            throw new DomainException("O convite precisa de um condomínio válido.");
        }

        if (invitedByUserId == Guid.Empty)
        {
            throw new DomainException("O convite precisa de um morador válido — não é permitido convite anônimo.");
        }

        var trimmedName = string.IsNullOrWhiteSpace(name) ? null : name.Trim();
        if (trimmedName is null)
        {
            throw new DomainException("Informe o nome do prestador.");
        }

        if (trimmedName.Length > MaxNameLength)
        {
            throw new DomainException($"O nome não pode ter mais de {MaxNameLength} caracteres.");
        }

        var trimmedPhone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
        if (trimmedPhone is null)
        {
            throw new DomainException("Informe o telefone do prestador.");
        }

        if (trimmedPhone.Length > MaxPhoneLength)
        {
            throw new DomainException($"O telefone não pode ter mais de {MaxPhoneLength} caracteres.");
        }

        var trimmedEmail = string.IsNullOrWhiteSpace(email) ? null : email.Trim();
        if (trimmedEmail is not null)
        {
            if (trimmedEmail.Length > MaxEmailLength)
            {
                throw new DomainException($"O e-mail não pode ter mais de {MaxEmailLength} caracteres.");
            }

            if (!trimmedEmail.Contains('@'))
            {
                throw new DomainException("Informe um e-mail válido.");
            }
        }

        return new ProfessionalInvitation(Guid.NewGuid(), condominiumId, invitedByUserId, trimmedName, trimmedPhone, trimmedEmail);
    }

    /// <summary>
    /// Registra o resultado do envio por canal, depois que os "senders"
    /// (Infrastructure — Twilio WhatsApp/SMS, Twilio SendGrid e-mail)
    /// tentaram entregar a mensagem. Chamado exatamente uma vez, logo após
    /// <see cref="Invite"/>, dentro do mesmo caso de uso — ver
    /// <c>ProfessionalInvitationService.InviteAsync</c>.
    /// </summary>
    public void RecordDeliveryResult(bool whatsAppDelivered, bool smsDelivered, bool? emailDelivered)
    {
        WhatsAppDelivered = whatsAppDelivered;
        SmsDelivered = smsDelivered;
        EmailDelivered = Email is null ? null : emailDelivered;
    }
}
