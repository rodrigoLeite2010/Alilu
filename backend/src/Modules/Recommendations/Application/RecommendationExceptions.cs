namespace Alilu.Modules.Recommendations.Application;

/// <summary>
/// Base para erros de aplicação do módulo Recommendations que a Api traduz
/// para respostas HTTP (ver <c>Alilu.Api.Middleware.ExceptionHandlingMiddleware</c>).
/// </summary>
public abstract class RecommendationsApplicationException : Exception
{
    protected RecommendationsApplicationException(string message) : base(message)
    {
    }
}

public sealed class RecommendationNotFoundException()
    : RecommendationsApplicationException("Recomendação não encontrada.");

/// <summary>"Não permitir spam ilimitado" (REGRA do PROMPT 10) — o morador já tem <see cref="RecommendationService.MaxPendingRecommendationsPerResident"/> recomendações aguardando moderação.</summary>
public sealed class TooManyPendingRecommendationsException()
    : RecommendationsApplicationException("Você já tem várias recomendações aguardando aprovação. Aguarde a moderação antes de enviar novas.");

public sealed class RecommendationNotPendingException()
    : RecommendationsApplicationException("Esta recomendação não está mais pendente de moderação.");

public sealed class RecommendationNotApprovedException()
    : RecommendationsApplicationException("Esta recomendação não está aprovada.");

/// <summary>
/// Segunda camada de defesa (a primeira é <c>[Authorize(Roles = ...)]</c>
/// no controller) — mesma filosofia dos demais módulos, tipo próprio deste
/// (nenhum módulo referencia outro).
/// </summary>
public sealed class InsufficientPermissionsException()
    : RecommendationsApplicationException("Você não tem permissão para executar esta ação.");
