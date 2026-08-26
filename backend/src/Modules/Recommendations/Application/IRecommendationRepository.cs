using Alilu.Modules.Recommendations.Domain;

namespace Alilu.Modules.Recommendations.Application;

/// <summary>Porta de persistência de <see cref="Recommendation"/>.</summary>
public interface IRecommendationRepository
{
    Task<Recommendation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>React Native: RecommendationsScreen — "minhas recomendações", mais recente primeiro.</summary>
    Task<IReadOnlyList<Recommendation>> ListByRecommendedByUserIdAsync(Guid recommendedByUserId, CancellationToken cancellationToken = default);

    /// <summary>"Não permitir spam ilimitado" — conta quantas recomendações deste morador ainda estão Pending, antes de criar uma nova.</summary>
    Task<int> CountPendingByRecommendedByUserIdAsync(Guid recommendedByUserId, CancellationToken cancellationToken = default);

    /// <summary>React Native: ProfessionalRecommendationsScreen — recomendações já aprovadas para este profissional, mais recente primeiro. Só faz sentido para recomendações vinculadas (<see cref="Recommendation.ProfessionalId"/> não nulo) — indicações externas nunca aparecem aqui.</summary>
    Task<IReadOnlyList<Recommendation>> ListApprovedByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default);

    /// <summary>Fila de moderação do administrador ("Administrador pode moderar"), mais antiga primeiro.</summary>
    Task<IReadOnlyList<Recommendation>> ListPendingAsync(CancellationToken cancellationToken = default);

    Task AddAsync(Recommendation recommendation, CancellationToken cancellationToken = default);
}
