namespace Alilu.Modules.Administration.Application;

/// <summary>
/// Base para erros de aplicação do módulo Administration que a Api traduz
/// para respostas HTTP (ver <c>Alilu.Api.Middleware.ExceptionHandlingMiddleware</c>).
/// </summary>
public abstract class AdministrationApplicationException : Exception
{
    protected AdministrationApplicationException(string message) : base(message)
    {
    }
}

/// <summary>
/// O <c>CondominiumAdmin</c> autenticado ainda não foi vinculado a nenhum
/// condomínio (ver <c>Domain.CondominiumAdministrator</c>) — estado possível
/// entre "usuário promovido a CondominiumAdmin" (ainda manual, via SQL — ver
/// pendências) e "SuperAdmin associou este admin a um condomínio"
/// (<see cref="IAdminScopeService.AssignAsync"/>). Mapeada para 403: não é
/// uma falha de quem chama, é um escopo administrável ainda vazio.
/// </summary>
public sealed class AdminNotAssignedToCondominiumException()
    : AdministrationApplicationException("Este administrador ainda não foi vinculado a nenhum condomínio.");

/// <summary>
/// Segunda camada de defesa (a primeira é <c>[Authorize(Roles = ...)]</c> no
/// controller) — mesma filosofia dos demais módulos, tipo próprio deste
/// (nenhum módulo referencia outro).
/// </summary>
public sealed class InsufficientPermissionsException()
    : AdministrationApplicationException("Você não tem permissão para executar esta ação.");
