using Alilu.Modules.Notifications.Application;
using Alilu.Modules.Notifications.Domain;
using Alilu.Modules.Professional.Application;
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
///
/// Etapa 23 (pedido de Rodrigo: "avaliar qualquer profissional buscando
/// pelo nome, sem precisar ter contratado antes") — <see cref="Create"/>
/// ganhou um segundo caminho: quando <c>body.BookingId</c> NÃO é
/// informado, a sequência acima (passo 1, validar Booking Completed) é
/// pulada por completo — só se valida que <c>body.ProfessionalId</c> existe
/// e está ativo no diretório (<see cref="IProfessionalDirectoryService.GetProfessionalProfileAsync"/>),
/// e a avaliação nasce "livre" (sem agendamento). A regra "somente Booking
/// Completed pode ser avaliado" nunca foi removida — ela só passou a valer
/// condicionalmente, apenas quando o morador está avaliando a partir de um
/// agendamento (fluxo original).
/// </summary>
[ApiController]
[Route("api/resident/reviews")]
[Authorize]
public sealed class ReviewsController(
    IReviewService reviewService,
    IBookingService bookingService,
    IProfessionalDirectoryService professionalDirectoryService,
    INotificationDispatcher notificationDispatcher) : ControllerBase
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
    /// Etapa 23 — mesmo padrão de <see cref="GetMineForBooking"/>, para a
    /// avaliação LIVRE (sem agendamento). React Native:
    /// ProfessionalProfileScreen usa isso pra decidir se o botão "Avaliar"
    /// abre em modo criação ou edição.
    /// </summary>
    [HttpGet("professional/{professionalId:guid}")]
    public async Task<ActionResult<ReviewResponse>> GetMineForProfessional(Guid professionalId, CancellationToken cancellationToken)
    {
        var review = await reviewService.GetMyFreeReviewForProfessionalAsync(User.GetUserId(), professionalId, cancellationToken);
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

        Guid professionalId;
        Guid? bookingId;

        if (body.BookingId is { } requestedBookingId)
        {
            // Fluxo original (PROMPT 09): "somente Booking Completed pode
            // ser avaliado" + "somente o Resident daquele Booking pode
            // avaliar" — ver comentário da classe.
            professionalId = await bookingService.ValidateCompletedBookingForReviewAsync(userId, requestedBookingId, cancellationToken);
            bookingId = requestedBookingId;
        }
        else
        {
            // Etapa 23 — avaliação LIVRE: sem Booking pra validar, só que o
            // profissional exista e esteja ativo no diretório (mesma
            // checagem que qualquer visualização de perfil público já faz).
            if (body.ProfessionalId is not { } requestedProfessionalId)
            {
                return BadRequest(new { title = "Informe bookingId (avaliação de um agendamento) ou professionalId (avaliação livre)." });
            }

            var profile = await professionalDirectoryService.GetProfessionalProfileAsync(requestedProfessionalId, cancellationToken);
            if (profile is null)
            {
                return NotFound(new { title = "Profissional não encontrado." });
            }

            professionalId = requestedProfessionalId;
            bookingId = null;
        }

        var review = await reviewService.CreateAsync(userId, bookingId, professionalId, body.Rating, body.Comment, cancellationToken);

        // EVENTO "nova avaliação" (PROMPT 11) — para o profissional. A
        // mensagem nunca inclui a nota nem o comentário (REGRA "não expor
        // informações sensíveis na notificação") — só o aviso de que uma
        // nova avaliação chegou; ver detalhes em ProfessionalReviewsScreen.
        var professionalUserId = await professionalDirectoryService.GetProfessionalUserIdAsync(professionalId, cancellationToken);
        await notificationDispatcher.NotifyAsync(
            professionalUserId,
            NotificationType.NewReview,
            "Nova avaliação recebida",
            "Você recebeu uma nova avaliação de um morador.",
            review.Id,
            cancellationToken);

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

/// <summary>
/// Corpo de POST .../reviews. Etapa 23: exatamente um entre
/// <see cref="BookingId"/> (avaliar um agendamento concluído) e
/// <see cref="ProfessionalId"/> (avaliação livre, sem agendamento) deve
/// vir preenchido — ver <see cref="ReviewsController.Create"/>.
/// </summary>
public sealed record CreateReviewBody(Guid? BookingId, Guid? ProfessionalId, int Rating, string? Comment);

/// <summary>Corpo de PUT .../reviews/{id}.</summary>
public sealed record EditReviewBody(int Rating, string? Comment);
