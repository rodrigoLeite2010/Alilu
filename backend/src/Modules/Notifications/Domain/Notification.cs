using Alilu.Shared;

namespace Alilu.Modules.Notifications.Domain;

/// <summary>
/// Uma notificação interna de um usuário (PROMPT 11) — sempre criada pela
/// Api (composição raiz) depois da ação principal de outro módulo (novo
/// agendamento, avaliação, recomendação aprovada, etc. — ver
/// <see cref="NotificationType"/>) ou por um processo de fundo (lembrete de
/// serviço). Este módulo nunca sabe, sozinho, QUANDO criar uma notificação
/// — só COMO representá-la e mantê-la (lida/não lida) — mesma separação de
/// responsabilidade das Etapas 08/09/10 (Scheduling/Reviews/Recommendations
/// nunca decidem regras de outro módulo sozinhos).
///
/// É sua própria raiz de agregado — de propósito NÃO há navegação/FK para
/// <c>User</c> (Identity) ou para a entidade referenciada por
/// <see cref="ReferenceId"/> (Booking/Review/Recommendation/Membership,
/// conforme <see cref="Type"/>) — só os Ids como valores simples, mesma
/// decisão de todos os módulos anteriores.
///
/// Campos exatamente como o prompt listou: Id, UserId, Title, Message,
/// Type, ReferenceId, ReadAt, CreatedAt (de propósito NÃO há
/// <c>UpdatedAt</c>, mesma decisão de <c>Review</c>/<c>Recommendation</c>).
/// O prompt não marcou nenhum campo desta entidade como nullable/opcional —
/// mesmo assim, dois precisam ser por natureza: <see cref="ReadAt"/> (toda
/// notificação nasce não lida) e <see cref="ReferenceId"/> (mantido
/// opcional para cobrir, no futuro, um tipo de notificação sem entidade
/// associada — nenhum dos dez EVENTOS desta etapa usa esse caminho, todos
/// sempre têm uma entidade de origem).
/// </summary>
public sealed class Notification : AggregateRoot
{
    public Guid UserId { get; private set; }
    public string Title { get; private set; }
    public string Message { get; private set; }
    public NotificationType Type { get; private set; }
    public Guid? ReferenceId { get; private set; }
    public DateTime? ReadAt { get; private set; }
    public DateTime CreatedAt { get; private set; }

    public bool IsRead => ReadAt.HasValue;

#pragma warning disable CS8618
    private Notification()
    {
    }
#pragma warning restore CS8618

    private Notification(Guid id, Guid userId, string title, string message, NotificationType type, Guid? referenceId)
        : base(id)
    {
        UserId = userId;
        Title = title;
        Message = message;
        Type = type;
        ReferenceId = referenceId;
        CreatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Cria a notificação. Quem chama (<c>INotificationDispatcher</c>, o
    /// único ponto de entrada de composição — ver ARCHITECTURE.md) já
    /// resolveu <paramref name="title"/>/<paramref name="message"/> como
    /// texto pronto para exibição, SEM nenhum dado sensível de outro módulo
    /// (REGRA "não expor informações sensíveis na notificação" — nunca
    /// telefone, endereço completo, valor cobrado, etc.; só o suficiente
    /// para identificar do que se trata, ex.: "Seu agendamento com o
    /// eletricista foi aceito").
    /// </summary>
    public static Notification Create(Guid userId, string title, string message, NotificationType type, Guid? referenceId)
    {
        if (userId == Guid.Empty)
        {
            throw new DomainException("A notificação precisa de um destinatário válido.");
        }

        var trimmedTitle = string.IsNullOrWhiteSpace(title) ? null : title.Trim();
        if (trimmedTitle is null)
        {
            throw new DomainException("A notificação precisa de um título.");
        }

        if (trimmedTitle.Length > 200)
        {
            throw new DomainException("O título não pode ter mais de 200 caracteres.");
        }

        var trimmedMessage = string.IsNullOrWhiteSpace(message) ? null : message.Trim();
        if (trimmedMessage is null)
        {
            throw new DomainException("A notificação precisa de uma mensagem.");
        }

        if (trimmedMessage.Length > 1000)
        {
            throw new DomainException("A mensagem não pode ter mais de 1000 caracteres.");
        }

        if (referenceId is { } id && id == Guid.Empty)
        {
            throw new DomainException("O ReferenceId, quando informado, não pode ser vazio.");
        }

        return new Notification(Guid.NewGuid(), userId, trimmedTitle, trimmedMessage, type, referenceId);
    }

    /// <summary>Marca como lida (React Native: NotificationCenter). Idempotente — ler de novo uma notificação já lida não é um erro, só não muda <see cref="ReadAt"/>.</summary>
    public void MarkAsRead()
    {
        if (IsRead)
        {
            return;
        }

        ReadAt = DateTime.UtcNow;
    }
}
