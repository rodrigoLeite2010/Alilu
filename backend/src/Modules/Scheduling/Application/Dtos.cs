using Alilu.Modules.Scheduling.Domain;

namespace Alilu.Modules.Scheduling.Application;

/// <summary>
/// Um serviço escolhido pelo morador ao criar o agendamento (React Native:
/// BookingServicesScreen — "selecionar serviços"). A existência/atividade
/// da categoria não é revalidada por este módulo — ver comentário em
/// <see cref="Domain.BookingItem"/>.
/// </summary>
public sealed record BookingItemInput(Guid ServiceCategoryId, string? Description, int Quantity);

public sealed record BookingItemResponse(
    Guid Id,
    Guid BookingId,
    Guid ServiceCategoryId,
    string? Description,
    int Quantity);

/// <summary>
/// Nunca inclui dados de outro módulo (nome do morador/profissional, nome
/// do condomínio, código da unidade, nome das categorias de serviço) — só
/// os Ids, exatamente como a entidade os guarda. Enriquecer para exibição é
/// responsabilidade da Api — mesma decisão de <c>MembershipResponse</c>
/// (Resident) e <c>ProfessionalResponse</c> (Professional).
/// </summary>
public sealed record BookingResponse(
    Guid Id,
    Guid ResidentId,
    Guid ProfessionalId,
    Guid CondominiumId,
    Guid UnitId,
    DateOnly ScheduledDate,
    TimeOnly StartTime,
    TimeOnly EndTime,
    BookingStatus Status,
    string? Notes,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<BookingItemResponse> Items);
