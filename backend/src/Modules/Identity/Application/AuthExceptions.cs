namespace Alilu.Modules.Identity.Application;

/// <summary>
/// Base para erros de aplicação do módulo Identity que a Api traduz para
/// respostas HTTP (ver mapeamento no controller).
/// </summary>
public abstract class IdentityApplicationException : Exception
{
    protected IdentityApplicationException(string message) : base(message)
    {
    }
}

public sealed class EmailAlreadyInUseException()
    : IdentityApplicationException("Este e-mail já está cadastrado.");

/// <summary>
/// Usada tanto para "usuário inexistente" quanto para "senha inválida" —
/// de propósito a mesma mensagem/exceção para os dois casos, para não
/// revelar a um atacante se um e-mail está ou não cadastrado
/// (enumeração de usuários é uma vulnerabilidade comum de login).
/// </summary>
public sealed class InvalidCredentialsException()
    : IdentityApplicationException("E-mail ou senha inválidos.");

public sealed class InvalidRoleForSelfRegistrationException()
    : IdentityApplicationException("Este papel não pode ser escolhido no cadastro.");

public sealed class InvalidRefreshTokenException()
    : IdentityApplicationException("Refresh token inválido, expirado ou revogado.");

public sealed class UserNotFoundException()
    : IdentityApplicationException("Usuário não encontrado.");

public sealed class UserBlockedException()
    : IdentityApplicationException("Esta conta está bloqueada.");

public sealed class WeakPasswordException()
    : IdentityApplicationException("A senha deve ter pelo menos 8 caracteres.");

/// <summary>
/// Etapa 21 (foto pessoal) — upload de foto rejeitado: formato não
/// suportado, base64 malformado ou tamanho acima do limite. Lançada por
/// <c>Alilu.Api.Services.IUserPhotoStorage</c> (não por este módulo
/// diretamente) — mora aqui porque toda exceção que a Api mapeia para
/// HTTP nesta área do sistema já segue esse padrão (ver
/// <c>ExceptionHandlingMiddleware</c>).
/// </summary>
public sealed class InvalidPhotoException(string reason)
    : IdentityApplicationException(reason);
