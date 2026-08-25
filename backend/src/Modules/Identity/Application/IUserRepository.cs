using Alilu.Modules.Identity.Domain;

namespace Alilu.Modules.Identity.Application;

/// <summary>
/// Porta de persistência de <see cref="User"/>. Implementada em
/// Infrastructure (EF Core); aqui é só a abstração usada pela Application.
/// </summary>
public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<User?> GetByEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default);

    Task<bool> ExistsByEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default);

    Task AddAsync(User user, CancellationToken cancellationToken = default);
}
