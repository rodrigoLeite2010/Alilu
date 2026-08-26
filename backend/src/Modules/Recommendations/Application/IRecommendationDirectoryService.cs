namespace Alilu.Modules.Recommendations.Application;

/// <summary>
/// Consulta pública, só-leitura, do "perfil de recomendações" de um
/// profissional já cadastrado no ALILU (React Native:
/// ProfessionalRecommendationsScreen — "Carlos Elétrica ⭐ 4.9 Recomendado
/// por 7 moradores"). Qualquer usuário autenticado pode chamar (morador
/// avaliando quem contratar, ou o próprio profissional vendo o seu perfil)
/// — não há distinção de papel aqui, mesmo espírito de
/// <c>IProfessionalDirectoryService</c> (Professional).
///
/// Só recomendações <see cref="Domain.RecommendationStatus.Approved"/> e
/// vinculadas (<c>ProfessionalId</c> não nulo) aparecem aqui — indicações
/// Pending/Rejected/Blocked e indicações externas nunca são expostas
/// publicamente.
/// </summary>
public interface IRecommendationDirectoryService
{
    /// <summary>Só a contagem (para compor o "Recomendado por N moradores" junto com o nome/nota, que vêm de outros módulos — ver <c>ProfessionalDirectoryController</c> na Api).</summary>
    Task<ProfessionalRecommendationSummaryResponse> GetSummaryByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default);

    /// <summary>A lista de recomendações aprovadas em si (comentários), mais recente primeiro.</summary>
    Task<IReadOnlyList<RecommendationResponse>> ListApprovedByProfessionalIdAsync(Guid professionalId, CancellationToken cancellationToken = default);
}
