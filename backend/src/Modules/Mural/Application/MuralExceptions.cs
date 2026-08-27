namespace Alilu.Modules.Mural.Application;

/// <summary>
/// Base para erros de aplicação do módulo Mural que a Api traduz para
/// respostas HTTP (ver <c>Alilu.Api.Middleware.ExceptionHandlingMiddleware</c>).
/// </summary>
public abstract class MuralApplicationException : Exception
{
    protected MuralApplicationException(string message) : base(message)
    {
    }
}

public sealed class MuralPostNotFoundException()
    : MuralApplicationException("Post do mural não encontrado.");

public sealed class MuralPostAlreadyBlockedException()
    : MuralApplicationException("Este post já está bloqueado.");

/// <summary>
/// Segunda camada de defesa (a primeira é <c>[Authorize(Roles = ...)]</c>
/// no controller) — mesma filosofia dos demais módulos, tipo próprio deste
/// (nenhum módulo referencia outro).
/// </summary>
public sealed class InsufficientPermissionsException()
    : MuralApplicationException("Você não tem permissão para executar esta ação.");
