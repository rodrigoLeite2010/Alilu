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

    /// <summary>
    /// Busca em lote (Etapa 12) — mesmo padrão de
    /// <c>Professional.Application.IProfessionalServiceRepository.ListActiveByProfessionalIdsAsync</c>:
    /// evita N+1 ao enriquecer listagens administrativas (nome/email de
    /// vários moradores/profissionais de uma vez) sem expor nenhum outro
    /// método de busca em massa. Ids desconhecidos são simplesmente
    /// omitidos do resultado (nunca lança).
    /// </summary>
    Task<IReadOnlyList<User>> ListByIdsAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken = default);

    Task AddAsync(User user, CancellationToken cancellationToken = default);
}
