using Alilu.Modules.Identity.Application;
using Alilu.Shared;

namespace Alilu.Api.Middleware;

/// <summary>
/// Traduz exceções lançadas pela Application em respostas HTTP, para os
/// controllers não precisarem de try/catch repetido. Cada exceção de
/// aplicação (ver AuthExceptions.cs / CondominiumExceptions.cs /
/// MembershipExceptions.cs) já nasceu pensada para virar um status HTTP
/// específico — este middleware só faz esse mapeamento.
///
/// NOTA (PROMPT 05/06): os módulos Condominium, Resident e Professional
/// cada um define seu próprio <c>InsufficientPermissionsException</c>
/// (mesmo nome, namespaces diferentes — nenhum módulo pode referenciar o
/// outro, então não têm como compartilhar um tipo comum) — por isso,
/// abaixo, essas linhas usam o nome totalmente qualificado em vez de um
/// `using` para cada módulo, o que causaria ambiguidade de nome no
/// `switch`.
///
/// Com cinco módulos implementados (Identity, Condominium, Resident,
/// Professional, Scheduling), o mapa direto por tipo já está bem grande —
/// se um sexto módulo repetir o mesmo padrão, vale extrair um contrato
/// comum em Alilu.Shared (ex.: uma interface `IHasHttpStatusCode`) em vez
/// de continuar empilhando `case`s aqui.
/// </summary>
public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception exception)
        {
            var (statusCode, title) = Map(exception);

            if (statusCode == StatusCodes.Status500InternalServerError)
            {
                logger.LogError(
                    exception,
                    "Erro não tratado ao processar {Method} {Path}",
                    context.Request.Method,
                    context.Request.Path);
            }

            context.Response.ContentType = "application/problem+json";
            context.Response.StatusCode = statusCode;

            await context.Response.WriteAsJsonAsync(new
            {
                status = statusCode,
                title,
            });
        }
    }

    private static (int StatusCode, string Title) Map(Exception exception) => exception switch
    {
        EmailAlreadyInUseException => (StatusCodes.Status409Conflict, exception.Message),
        InvalidCredentialsException => (StatusCodes.Status401Unauthorized, exception.Message),
        InvalidRefreshTokenException => (StatusCodes.Status401Unauthorized, exception.Message),
        UserBlockedException => (StatusCodes.Status403Forbidden, exception.Message),
        UserNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
        InvalidRoleForSelfRegistrationException => (StatusCodes.Status400BadRequest, exception.Message),
        WeakPasswordException => (StatusCodes.Status400BadRequest, exception.Message),
        InvalidPhotoException => (StatusCodes.Status400BadRequest, exception.Message),

        // Módulo Condominium (PROMPT 04).
        Alilu.Modules.Condominium.Application.CnpjAlreadyInUseException => (StatusCodes.Status409Conflict, exception.Message),
        Alilu.Modules.Condominium.Application.DuplicateUnitCodeException => (StatusCodes.Status409Conflict, exception.Message),
        Alilu.Modules.Condominium.Application.CondominiumNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
        Alilu.Modules.Condominium.Application.CondominiumUnitNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
        Alilu.Modules.Condominium.Application.CondominiumInvitationNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
        Alilu.Modules.Condominium.Application.UnitDoesNotBelongToCondominiumException => (StatusCodes.Status400BadRequest, exception.Message),
        Alilu.Modules.Condominium.Application.InsufficientPermissionsException => (StatusCodes.Status403Forbidden, exception.Message),

        // Resgate de convite / diretório público (PROMPT 05).
        Alilu.Modules.Condominium.Application.InvitationNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
        Alilu.Modules.Condominium.Application.InvitationExpiredException => (StatusCodes.Status400BadRequest, exception.Message),
        Alilu.Modules.Condominium.Application.InvitationAlreadyUsedException => (StatusCodes.Status409Conflict, exception.Message),
        Alilu.Modules.Condominium.Application.InvitationEmailMismatchException => (StatusCodes.Status400BadRequest, exception.Message),

        // Módulo Resident (PROMPT 05).
        Alilu.Modules.Resident.Application.MembershipNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
        Alilu.Modules.Resident.Application.DuplicateMembershipException => (StatusCodes.Status409Conflict, exception.Message),
        Alilu.Modules.Resident.Application.MembershipNotPendingException => (StatusCodes.Status409Conflict, exception.Message),
        Alilu.Modules.Resident.Application.MembershipNotActiveException => (StatusCodes.Status409Conflict, exception.Message),
        Alilu.Modules.Resident.Application.InsufficientPermissionsException => (StatusCodes.Status403Forbidden, exception.Message),

        // Módulo Professional (PROMPT 06).
        Alilu.Modules.Professional.Application.ProfessionalNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
        Alilu.Modules.Professional.Application.ProfessionalAlreadyExistsException => (StatusCodes.Status409Conflict, exception.Message),
        Alilu.Modules.Professional.Application.ServiceCategoryNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
        Alilu.Modules.Professional.Application.ServiceCategoryInactiveException => (StatusCodes.Status400BadRequest, exception.Message),
        Alilu.Modules.Professional.Application.DuplicateProfessionalServiceException => (StatusCodes.Status409Conflict, exception.Message),
        Alilu.Modules.Professional.Application.ProfessionalServiceNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
        Alilu.Modules.Professional.Application.DuplicateProfessionalCondominiumException => (StatusCodes.Status409Conflict, exception.Message),
        Alilu.Modules.Professional.Application.ProfessionalCondominiumNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
        Alilu.Modules.Professional.Application.ProfessionalCondominiumNotPendingException => (StatusCodes.Status409Conflict, exception.Message),
        Alilu.Modules.Professional.Application.InsufficientPermissionsException => (StatusCodes.Status403Forbidden, exception.Message),

        // Disponibilidade (PROMPT 07).
        Alilu.Modules.Professional.Application.ProfessionalAvailabilityNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
        Alilu.Modules.Professional.Application.OverlappingAvailabilityException => (StatusCodes.Status409Conflict, exception.Message),
        Alilu.Modules.Professional.Application.ProfessionalAvailabilityExceptionNotFoundException => (StatusCodes.Status404NotFound, exception.Message),

        // Validações de agendamento — Professional (PROMPT 08).
        Alilu.Modules.Professional.Application.ProfessionalDoesNotAttendCondominiumException => (StatusCodes.Status400BadRequest, exception.Message),
        Alilu.Modules.Professional.Application.TimeSlotUnavailableException => (StatusCodes.Status409Conflict, exception.Message),

        // Validação de agendamento — Resident (PROMPT 08).
        Alilu.Modules.Resident.Application.NoActiveMembershipException => (StatusCodes.Status403Forbidden, exception.Message),

        // Módulo Scheduling (PROMPT 08 — "o módulo mais crítico").
        Alilu.Modules.Scheduling.Application.BookingNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
        Alilu.Modules.Scheduling.Application.InvalidBookingItemsException => (StatusCodes.Status400BadRequest, exception.Message),
        Alilu.Modules.Scheduling.Application.BookingConflictException => (StatusCodes.Status409Conflict, exception.Message),
        Alilu.Modules.Scheduling.Application.InsufficientPermissionsException => (StatusCodes.Status403Forbidden, exception.Message),

        // Validação de agendamento para avaliação — Scheduling (PROMPT 09).
        Alilu.Modules.Scheduling.Application.BookingNotCompletedException => (StatusCodes.Status409Conflict, exception.Message),

        // Módulo Reviews (PROMPT 09).
        Alilu.Modules.Reviews.Application.ReviewNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
        Alilu.Modules.Reviews.Application.DuplicateReviewException => (StatusCodes.Status409Conflict, exception.Message),

        // Módulo Recommendations (PROMPT 10). TooManyPendingRecommendationsException
        // é o primeiro uso de 429 nesta Api — "não permitir spam ilimitado"
        // é, por natureza, uma questão de limite de taxa, não de conflito
        // de estado (409) nem de corpo inválido (400).
        Alilu.Modules.Recommendations.Application.RecommendationNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
        Alilu.Modules.Recommendations.Application.TooManyPendingRecommendationsException => (StatusCodes.Status429TooManyRequests, exception.Message),
        Alilu.Modules.Recommendations.Application.RecommendationNotPendingException => (StatusCodes.Status409Conflict, exception.Message),
        Alilu.Modules.Recommendations.Application.RecommendationNotApprovedException => (StatusCodes.Status409Conflict, exception.Message),
        Alilu.Modules.Recommendations.Application.InsufficientPermissionsException => (StatusCodes.Status403Forbidden, exception.Message),
        // Etapa 14 (auditoria) — "recomendar a si mesmo" é uma requisição
        // malformada do ponto de vista de negócio, não um conflito de estado.
        Alilu.Modules.Recommendations.Application.SelfRecommendationException => (StatusCodes.Status400BadRequest, exception.Message),

        // Etapa 14 (auditoria) — corrida genuína entre duas requisições
        // concorrentes na checagem "não permitir spam ilimitado" (mesmo
        // espírito de BookingConflictException, tipo próprio deste módulo).
        Alilu.Modules.Recommendations.Application.RecommendationConflictException => (StatusCodes.Status409Conflict, exception.Message),

        // Módulo Notifications (PROMPT 11).
        Alilu.Modules.Notifications.Application.NotificationNotFoundException => (StatusCodes.Status404NotFound, exception.Message),

        // Módulo Administration (Etapa 12 / PROMPT 12) — sexto módulo a
        // repetir o padrão de InsufficientPermissionsException citado no
        // comentário da classe; mantido como case explícito por
        // consistência com os cinco anteriores, mas reforça que vale a
        // extração de um contrato comum numa próxima etapa que mexa aqui.
        Alilu.Modules.Administration.Application.AdminNotAssignedToCondominiumException => (StatusCodes.Status403Forbidden, exception.Message),
        Alilu.Modules.Administration.Application.InsufficientPermissionsException => (StatusCodes.Status403Forbidden, exception.Message),

        UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, exception.Message),
        DomainException => (StatusCodes.Status400BadRequest, exception.Message),
        _ => (StatusCodes.Status500InternalServerError, "Ocorreu um erro inesperado."),
    };
}
