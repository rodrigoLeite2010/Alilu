namespace Alilu.Modules.Mural.Application;

/// <summary>
/// Casos de uso self-service do morador (Etapa 23, pedido 3: "Mural, onde
/// e texto aberto por morador") — qualquer usuário autenticado pode
/// chamar, sempre restrito ao próprio <c>authorUserId</c> na criação.
///
/// IMPORTANTE (independência de módulos — PROMPT 01): este módulo não pode
/// referenciar o módulo Resident. Por isso <see cref="CreateAsync"/>
/// recebe <c>condominiumId</c> já resolvido/validado por quem chama — a
/// REGRA CRÍTICA "morador Active pode publicar" é responsabilidade da Api
/// (composição raiz), que chama <c>IMembershipService.GetMyActiveMembershipAsync</c>
/// (módulo Resident) ANTES deste método — ver <c>MuralController</c> e o
/// mesmo raciocínio já documentado em <c>RecommendationsController</c>
/// (Etapa 10).
/// </summary>
public interface IMuralService
{
    /// <summary>React Native: tela "Novo post" do Mural.</summary>
    Task<MuralPostResponse> CreateAsync(
        Guid condominiumId,
        Guid authorUserId,
        Domain.MuralPostType type,
        string content,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// React Native: MuralScreen — feed do condomínio do morador
    /// autenticado (visível para todos + os próprios posts, mesmo se
    /// bloqueados — ver <see cref="IMuralPostRepository.ListForResidentFeedAsync"/>).
    /// </summary>
    Task<IReadOnlyList<MuralPostResponse>> ListForResidentFeedAsync(
        Guid condominiumId,
        Guid requestingUserId,
        CancellationToken cancellationToken = default);
}
