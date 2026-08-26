namespace Alilu.Modules.Reviews.Application;

/// <summary>
/// Base para erros de aplicação do módulo Reviews que a Api traduz para
/// respostas HTTP (ver <c>Alilu.Api.Middleware.ExceptionHandlingMiddleware</c>).
/// </summary>
public abstract class ReviewsApplicationException : Exception
{
    protected ReviewsApplicationException(string message) : base(message)
    {
    }
}

public sealed class ReviewNotFoundException()
    : ReviewsApplicationException("Avaliação não encontrada.");

/// <summary>"Somente uma Review por Booking" (REGRA CRÍTICA do PROMPT 09) — lançada tanto pela checagem em memória (<c>ReviewService.CreateAsync</c>) quanto pelo índice único do banco (ver <c>ReviewConfiguration</c>), rede de segurança para a corrida entre duas requisições concorrentes.</summary>
public sealed class DuplicateReviewException()
    : ReviewsApplicationException("Este agendamento já foi avaliado.");
