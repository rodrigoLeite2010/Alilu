using Alilu.Modules.Mural.Domain;

namespace Alilu.Modules.Mural.Application;

/// <summary>Porta de persistência de <see cref="MuralPost"/>.</summary>
public interface IMuralPostRepository
{
    Task<MuralPost?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>
    /// React Native: MuralScreen — feed geral do condomínio. Devolve os
    /// posts <see cref="MuralPostStatus.Visible"/> de <paramref name="condominiumId"/>
    /// MAIS os do próprio <paramref name="requestingUserId"/> (mesmo que
    /// bloqueados) — regra de moderação confirmada por Rodrigo: um post
    /// bloqueado "fica só visível pro próprio autor e pro admin, como
    /// histórico" (ver comentário em <see cref="Domain.MuralPostStatus"/>).
    /// Mais recente primeiro.
    /// </summary>
    Task<IReadOnlyList<MuralPost>> ListForResidentFeedAsync(Guid condominiumId, Guid requestingUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// admin-web: página Mural — TODOS os posts (qualquer status) de um
    /// condomínio, mais recente primeiro; suporte para moderação
    /// ("Bloquear") e dashboard, mesmo papel de
    /// <c>IRecommendationRepository.ListByCondominiumIdAsync</c>.
    /// </summary>
    Task<IReadOnlyList<MuralPost>> ListByCondominiumIdAsync(Guid condominiumId, CancellationToken cancellationToken = default);

    Task AddAsync(MuralPost post, CancellationToken cancellationToken = default);
}
