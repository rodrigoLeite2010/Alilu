namespace Alilu.Modules.Condominium.Application;

/// <summary>
/// Base para erros de aplicação do módulo Condominium que a Api traduz
/// para respostas HTTP (ver mapeamento no
/// <c>Alilu.Api.Middleware.ExceptionHandlingMiddleware</c>).
/// </summary>
public abstract class CondominiumApplicationException : Exception
{
    protected CondominiumApplicationException(string message) : base(message)
    {
    }
}

public sealed class CnpjAlreadyInUseException()
    : CondominiumApplicationException("Este CNPJ já está cadastrado.");

public sealed class CondominiumNotFoundException()
    : CondominiumApplicationException("Condomínio não encontrado.");

public sealed class DuplicateUnitCodeException()
    : CondominiumApplicationException("Já existe uma unidade com este código neste condomínio.");

public sealed class CondominiumUnitNotFoundException()
    : CondominiumApplicationException("Unidade não encontrada.");

public sealed class UnitDoesNotBelongToCondominiumException()
    : CondominiumApplicationException("A unidade informada não pertence a este condomínio.");

public sealed class CondominiumInvitationNotFoundException()
    : CondominiumApplicationException("Convite não encontrado.");

/// <summary>
/// Segunda camada de defesa (a primeira é <c>[Authorize(Roles = ...)]</c>
/// no controller — ver ARCHITECTURE.md) — mesma filosofia usada em
/// <c>InvalidRoleForSelfRegistrationException</c> no módulo Identity.
/// </summary>
public sealed class InsufficientPermissionsException()
    : CondominiumApplicationException("Você não tem permissão para executar esta ação.");

// PROMPT 05 — resgate de convite (IInvitationRedemptionService). Erros
// distintos dos administrativos acima porque aqui quem está errando é o
// morador que digitou o código, não um admin — mensagens/status HTTP
// diferentes fazem sentido (ver ExceptionHandlingMiddleware).

/// <summary>Código de convite inexistente (nunca existiu, ou foi digitado errado).</summary>
public sealed class InvitationNotFoundException()
    : CondominiumApplicationException("Código de convite inválido.");

/// <summary>Convite encontrado, mas já passou da validade (<see cref="Domain.CondominiumInvitation.IsExpired"/>).</summary>
public sealed class InvitationExpiredException()
    : CondominiumApplicationException("Este convite expirou.");

/// <summary>Convite encontrado, mas já foi resgatado por alguém antes (<see cref="Domain.CondominiumInvitation.IsUsed"/>).</summary>
public sealed class InvitationAlreadyUsedException()
    : CondominiumApplicationException("Este convite já foi utilizado.");

/// <summary>
/// O convite foi emitido para um e-mail específico e quem está resgatando
/// informou um e-mail diferente — checagem "quando aplicável" (PROMPT 05):
/// só é feita quando o chamador informa um e-mail (ver
/// <c>InvitationRedemptionService.ValidateInvitationAsync</c>).
/// </summary>
public sealed class InvitationEmailMismatchException()
    : CondominiumApplicationException("Este convite foi emitido para outro e-mail.");
