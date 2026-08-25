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
