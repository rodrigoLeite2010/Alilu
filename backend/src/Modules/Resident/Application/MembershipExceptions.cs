namespace Alilu.Modules.Resident.Application;

/// <summary>
/// Base para erros de aplicação do módulo Resident que a Api traduz para
/// respostas HTTP (ver <c>Alilu.Api.Middleware.ExceptionHandlingMiddleware</c>).
/// </summary>
public abstract class ResidentApplicationException : Exception
{
    protected ResidentApplicationException(string message) : base(message)
    {
    }
}

public sealed class MembershipNotFoundException()
    : ResidentApplicationException("Vínculo não encontrado.");

/// <summary>
/// "Não permitir vínculo duplicado" (PROMPT 05) — o usuário já tem um
/// vínculo Pending ou Active para exatamente esta combinação de
/// condomínio+unidade (ver índice único filtrado em
/// <c>MembershipConfiguration</c>, segunda camada de defesa desta mesma
/// regra).
/// </summary>
public sealed class DuplicateMembershipException()
    : ResidentApplicationException("Você já possui um vínculo com esta unidade.");

public sealed class MembershipNotPendingException()
    : ResidentApplicationException("Este vínculo não está mais pendente de aprovação.");

public sealed class MembershipNotActiveException()
    : ResidentApplicationException("Este vínculo não está ativo.");

/// <summary>
/// Segunda camada de defesa (a primeira é <c>[Authorize(Roles = ...)]</c>
/// no controller) — mesma filosofia de
/// <c>Alilu.Modules.Condominium.Application.InsufficientPermissionsException</c>,
/// só que é um tipo próprio deste módulo (nenhum módulo referencia outro).
/// </summary>
public sealed class InsufficientPermissionsException()
    : ResidentApplicationException("Você não tem permissão para executar esta ação.");
