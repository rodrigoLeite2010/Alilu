using Alilu.Modules.Reviews.Application;
using Alilu.Modules.Scheduling.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alilu.Api.Controllers;

/// <summary>
/// Endpoints self-service do lado do morador (PROMPT 09) — qualquer usuário
/// autenticado pode chamar, sempre restrito ao próprio usuário
/// (<c>User.GetUserId()</c>), mesmo padrão de <see cref="BookingsController"/>.
///
/// Ponto de COMPOSIÇÃO para <see cref="Create"/> e <see cref="Edit"/>: o
/// módulo Reviews não pode referenciar o módulo Scheduling (PROMPT 01),
/// então é aqui — a Api, composição raiz — que as REGRAS CRÍTICAS do
/// prompt que cruzam módulos são aplicadas ANTES de deixar o módulo Reviews
/// gravar a avaliação:
///
/// 1. "Somente Booking Completed pode ser avaliado" + "somente o Resident
///    daquele Booking pode avaliar" — <see cref="IBookingService.ValidateCompletedBookingForReviewAsync"/>
///    (módulo Scheduling), que também devolve o <c>ProfessionalId</c> do
///    agendamento — o módulo Reviews não tem como descobri-lo sozinho.
/// 2. Só então <see cref="IReviewService.CreateAsync"/> (módulo Reviews) —
///    que ainda garante sozinho "somente uma Review por Booking".
///
/// Mesma sequência se repete em <see cref="Edit"/>: "editar avaliação
/// dentro da regra definida" reaproveita a mesma validação de Booking
/// Completed/autoria da criação (nenhuma janela de tempo nova inventada —
/// ver ARCHITECTURE.md, "Etapa 09").
/// </summary>
[ApiController]
[Route("api/resident/reviews")]
[Authorize]
public sealed class ReviewsController(
    IReviewService reviewService,
    IBookingService bookingService) : ControllerBase
{
    /// <summary>React Native: ReviewScreen — "visualizar avaliações feitas".</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ReviewResponse>>> ListMine(CancellationToken cancellationToken)
    {
        var reviews = await reviewService.ListMyReviewsAsync(User.GetUserId(), cancellationToken);
        return Ok(reviews);
    }

    /// <summary>
    /// Devolve a avaliação do morador para este agendamento, ou 204 sem
    /// corpo quando ainda não existe (mesmo padrão de outros módulos —
    /// ver <see cref="IReviewService.GetMyReviewForBookingAsync"/>).
    /// React Native: a rota hospedeira (<c>bookings/[id]/review.tsx</c>)
    /// usa isso para decidir se ReviewScreen abre em modo "avaliar" ou
    /// "ver/editar avaliação".
    /// </summary>
    [HttpGet("booking/{bookingId:guid}")]
    public async Task<ActionResult<ReviewResponse>> GetMineForBooking(Guid bookingId, CancellationToken cancellationToken)
    {
        var review = await reviewService.GetMyReviewForBookingAsync(User.GetUserId(), bookingId, cancellationToken);
        return review is null ? NoContent() : Ok(review);
    }

    /// <summary>
    /// React Native: ReviewScreen — "avaliar profissional". Ver o
    /// comentário da classe para a sequência completa de composição/validação.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ReviewResponse>> Create([FromBody] CreateReviewBody body, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();

        var professionalId = await bookingService.ValidateCompletedBookingForReviewAsync(userId, body.BookingId, cancellationToken);

        var review = await reviewService.CreateAsync(userId, body.BookingId, professionalId, body.Rating, body.Comment, cancellationToken);

        return StatusCode(StatusCodes.Status201Created, review);
    }

    /// <summary>React Native: ReviewScreen — "editar avaliação dentro da regra definida".</summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ReviewResponse>> Edit(Guid id, [FromBody] EditReviewBody body, CancellationToken cancellationToken)
    {
        var review = await reviewService.EditAsync(User.GetUserId(), id, body.Rating, body.Comment, cancellationToken);
        return Ok(review);
    }
}

/// <summary>Corpo de POST .../reviews.</summary>
public sealed record CreateReviewBody(Guid BookingId, int Rating, string? Comment);

/// <summary>Corpo de PUT .../reviews/{id}.</summary>
public sealed record EditReviewBody(int Rating, string? Comment);
