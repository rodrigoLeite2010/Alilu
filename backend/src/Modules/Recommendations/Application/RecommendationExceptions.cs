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
/// CORREÇÃO (Etapa 14, auditoria) — "recomendação" pressupõe uma indicação
/// de confiança de OUTRA pessoa; nada impedia um morador que também é
/// profissional cadastrado de recomendar a si mesmo, inflando a própria
/// contagem de recomendações ("Recomendado por N moradores", Etapa 10) sem
/// nenhum morador de verdade ter indicado nada. Detectado pela Api
/// (composição raiz — este módulo não conhece <c>Professional.UserId</c>,
/// só o <c>ProfessionalId</c>), lançado aqui por ser uma regra deste módulo
/// (mesmo padrão de reaproveitar <c>NoActiveMembershipException</c>, do
/// módulo Resident, no controller).
/// </summary>
public sealed class SelfRecommendationException()
    : RecommendationsApplicationException("Você não pode recomendar a si mesmo.");

/// <summary>
/// CORREÇÃO (Etapa 14, auditoria) — "não permitir spam ilimitado" (REGRA do
/// PROMPT 10) tinha uma corrida genuína: duas requisições concorrentes do
/// mesmo morador podiam ler a mesma contagem de pendentes ANTES de
/// qualquer uma commitar, e as duas passavam pela checagem de
/// <see cref="RecommendationService.MaxPendingRecommendationsPerResident"/>.
/// Corrigido com uma transação <c>Serializable</c> (ver
/// <see cref="IUnitOfWork.ExecuteInSerializableTransactionAsync{T}"/>, mesmo
/// mecanismo do módulo Scheduling para o conflito de horário) — quando o
/// PostgreSQL detecta esse tipo de corrida, esta exceção é lançada em vez
/// de deixar o teto ser ultrapassado silenciosamente. Ao contrário de
/// <see cref="TooManyPendingRecommendationsException"/> (o teto FOI
/// realmente atingido), esta representa uma corrida genuína — o cliente
/// deve simplesmente tentar de novo.
/// </summary>
public sealed class RecommendationConflictException()
    : RecommendationsApplicationException("Não foi possível registrar sua indicação agora — tente novamente.");

/// <summary>
/// Segunda camada de defesa (a primeira é <c>[Authorize(Roles = ...)]</c>
/// no controller) — mesma filosofia dos demais módulos, tipo próprio deste
/// (nenhum módulo referencia outro).
/// </summary>
public sealed class InsufficientPermissionsException()
    : RecommendationsApplicationException("Você não tem permissão para executar esta ação.");
