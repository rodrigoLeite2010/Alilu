namespace Alilu.Modules.Professional.Application;

/// <summary>
/// Caso de uso self-service do morador (Etapa 23, pedido 1: "convidar um
/// prestador") — qualquer usuário autenticado pode chamar, sempre
/// restrito ao próprio <c>invitedByUserId</c>.
///
/// IMPORTANTE (independência de módulos — PROMPT 01): este módulo não pode
/// referenciar o módulo Resident/Condominium. Por isso <see cref="InviteAsync"/>
/// recebe <c>condominiumId</c>/<c>condominiumName</c> já resolvidos/
/// validados por quem chama — a REGRA CRÍTICA "morador Active pode
/// convidar" é responsabilidade da Api (composição raiz), que chama
/// <c>IMembershipService.GetMyActiveMembershipAsync</c> (módulo Resident) e
/// o diretório público do módulo Condominium ANTES deste método — ver
/// <c>ProfessionalInvitationsController</c> e o mesmo raciocínio já
/// documentado em <c>RecommendationsController</c> (Etapa 10)/
/// <c>MuralController</c> (Etapa 23).
/// </summary>
public interface IProfessionalInvitationService
{
    /// <summary>
    /// React Native: tela "Convidar prestador". Lança
    /// <see cref="TooManyInvitationsException"/> quando o morador já
    /// atingiu o limite diário de convites.
    /// </summary>
    Task<ProfessionalInvitationResponse> InviteAsync(
        Guid condominiumId,
        Guid invitedByUserId,
        string condominiumName,
        string name,
        string phone,
        string? email,
        CancellationToken cancellationToken = default);

    /// <summary>React Native: tela "Convidar prestador" — histórico "convites enviados".</summary>
    Task<IReadOnlyList<ProfessionalInvitationResponse>> ListMyInvitationsAsync(Guid invitedByUserId, CancellationToken cancellationToken = default);
}
