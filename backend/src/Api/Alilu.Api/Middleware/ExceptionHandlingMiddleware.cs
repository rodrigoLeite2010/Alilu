using Alilu.Modules.Condominium.Application;
using Alilu.Modules.Identity.Application;
using Alilu.Shared;

namespace Alilu.Api.Middleware;

/// <summary>
/// Traduz exceções lançadas pela Application em respostas HTTP, para os
/// controllers não precisarem de try/catch repetido. Cada exceção de
/// aplicação (ver AuthExceptions.cs / CondominiumExceptions.cs) já nasceu
/// pensada para virar um status HTTP específico — este middleware só faz
/// esse mapeamento.
///
/// Com dois módulos implementados (Identity, Condominium), o mapa direto
/// por tipo já está começando a crescer — se um terceiro módulo repetir o
/// mesmo padrão, vale extrair um contrato comum em Alilu.Shared (ex.: uma
/// interface `IHasHttpStatusCode`) em vez de continuar empilhando `case`s
/// aqui.
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

        // Módulo Condominium (PROMPT 04).
        CnpjAlreadyInUseException => (StatusCodes.Status409Conflict, exception.Message),
        DuplicateUnitCodeException => (StatusCodes.Status409Conflict, exception.Message),
        CondominiumNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
        CondominiumUnitNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
        CondominiumInvitationNotFoundException => (StatusCodes.Status404NotFound, exception.Message),
        UnitDoesNotBelongToCondominiumException => (StatusCodes.Status400BadRequest, exception.Message),
        InsufficientPermissionsException => (StatusCodes.Status403Forbidden, exception.Message),

        UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, exception.Message),
        DomainException => (StatusCodes.Status400BadRequest, exception.Message),
        _ => (StatusCodes.Status500InternalServerError, "Ocorreu um erro inesperado."),
    };
}
