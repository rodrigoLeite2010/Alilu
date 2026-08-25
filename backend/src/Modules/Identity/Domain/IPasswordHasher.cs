namespace Alilu.Modules.Identity.Domain;

/// <summary>
/// Serviço de domínio para hash/verificação de senha. Nunca armazenar
/// senha em texto puro — apenas o resultado de <see cref="Hash"/> é
/// persistido (<c>User.PasswordHash</c>).
/// </summary>
public interface IPasswordHasher
{
    string Hash(string plainTextPassword);

    bool Verify(string plainTextPassword, string passwordHash);
}
