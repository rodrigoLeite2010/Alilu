using Alilu.Shared;

namespace Alilu.Modules.Reviews.Domain;

/// <summary>
/// A avaliação de um morador sobre um profissional, referente a UM
/// agendamento específico (PROMPT 09). É sua própria raiz de agregado —
/// mesma decisão de todos os módulos anteriores: de propósito NÃO há
/// navegação/FK para <c>Booking</c> (Scheduling), <c>User</c> (Identity) ou
/// <c>Professional</c> (Professional) — só os Ids como valores simples.
///
/// REGRAS CRÍTICAS que dependem de outro módulo ("somente Booking
/// Completed pode ser avaliado", "somente o Resident daquele Booking pode
/// avaliar", "somente uma Review por Booking") são responsabilidade da Api
/// (composição raiz) ANTES de chamar <c>ReviewService.CreateAsync</c> — ver
/// <c>ReviewsController</c> e ARCHITECTURE.md, "Etapa 09 — composição". A
/// única regra de duplicidade que este módulo pode e deve garantir sozinho
/// é o índice único em <see cref="BookingId"/> (Infrastructure).
///
/// Campos exatamente como o prompt listou: Id, BookingId, ResidentId,
/// ProfessionalId, Rating, Comment, CreatedAt — de propósito NÃO há
/// <c>UpdatedAt</c> (diferente de <c>Booking</c>, que listou os dois campos
/// explicitamente na Etapa 08); "editar avaliação" (<see cref="Edit"/>)
/// muda <see cref="Rating"/>/<see cref="Comment"/> sem tocar em nenhum
/// campo de data.
///
/// "Não permitir avaliação anônima": <see cref="ResidentId"/> é sempre
/// obrigatório (nunca nulo/vazio) — não existe conceito de avaliação sem
/// autor nesta entidade.
/// </summary>
public sealed class Review : AggregateRoot
{
    public Guid BookingId { get; private set; }
    public Guid ResidentId { get; private set; }
    public Guid ProfessionalId { get; private set; }
    public int Rating { get; private set; }
    public string? Comment { get; private set; }
    public DateTime CreatedAt { get; private set; }

#pragma warning disable CS8618
    private Review()
    {
    }
#pragma warning restore CS8618

    private Review(
        Guid id,
        Guid bookingId,
        Guid residentId,
        Guid professionalId,
        int rating,
        string? comment)
        : base(id)
    {
        BookingId = bookingId;
        ResidentId = residentId;
        ProfessionalId = professionalId;
        Rating = rating;
        Comment = comment;
        CreatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Cria a avaliação (React Native: ReviewScreen — "avaliar profissional").
    /// Todas as REGRAS CRÍTICAS que dependem de outro módulo (Booking
    /// Completed, autoria, unicidade por Booking) já devem ter sido
    /// validadas por quem chama (a Api) — esta entidade, isolada, só valida
    /// a própria consistência interna.
    /// </summary>
    public static Review Create(
        Guid bookingId,
        Guid residentId,
        Guid professionalId,
        int rating,
        string? comment)
    {
        if (bookingId == Guid.Empty)
        {
            throw new DomainException("A avaliação precisa de um agendamento válido.");
        }

        if (residentId == Guid.Empty)
        {
            throw new DomainException("A avaliação precisa de um morador válido — não é permitida avaliação anônima.");
        }

        if (professionalId == Guid.Empty)
        {
            throw new DomainException("A avaliação precisa de um profissional válido.");
        }

        EnsureValidRating(rating);
        var trimmedComment = TrimComment(comment);

        return new Review(Guid.NewGuid(), bookingId, residentId, professionalId, rating, trimmedComment);
    }

    /// <summary>React Native: ReviewScreen — "editar avaliação dentro da regra definida". A regra é a mesma de criação (autoria/Booking Completed), validada por quem chama; aqui só se revalida o próprio Rating/Comment.</summary>
    public void Edit(int rating, string? comment)
    {
        EnsureValidRating(rating);
        Rating = rating;
        Comment = TrimComment(comment);
    }

    private static void EnsureValidRating(int rating)
    {
        if (rating is < 1 or > 5)
        {
            throw new DomainException("A nota da avaliação precisa estar entre 1 e 5.");
        }
    }

    private static string? TrimComment(string? comment)
    {
        var trimmed = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
        if (trimmed is { Length: > 1000 })
        {
            throw new DomainException("O comentário não pode ter mais de 1000 caracteres.");
        }

        return trimmed;
    }
}
