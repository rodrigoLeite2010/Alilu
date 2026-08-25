namespace Alilu.Modules.Resident.Application;

/// <summary>
/// Casos de uso self-service deste módulo — qualquer usuário autenticado
/// pode chamar, sempre restrito ao próprio <c>userId</c> (não recebe papel
/// nenhum para checar, ao contrário de <see cref="IMembershipAdministrationService"/>,
/// porque cada método aqui só enxerga/cria vínculo do próprio chamador —
/// "seguro por construção", nunca lê nem escreve vínculo de outro usuário).
///
/// IMPORTANTE (independência de módulos — PROMPT 01): este módulo não
/// pode referenciar o módulo Condominium. Por isso os métodos de criação
/// abaixo recebem <c>condominiumId</c>/<c>unitId</c> já resolvidos e
/// validados por quem chamou — nunca um código de convite bruto nem um
/// Id "cru" vindo direto do corpo da requisição HTTP sem checagem. Essa
/// resolução/validação (resgatar o convite, ou confirmar que a unidade
/// pertence ao condomínio informado) é feita pela Api (composição raiz),
/// que é o único lugar autorizado a falar com os dois módulos ao mesmo
/// tempo — ver <c>ResidentMembershipsController</c>.
/// </summary>
public interface IMembershipService
{
    /// <summary>O vínculo Active do usuário, se houver — usado pelo app para decidir se mostra a área do morador ou o fluxo de validação (PROMPT 05, "acesso sem vínculo").</summary>
    Task<MembershipResponse?> GetMyActiveMembershipAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<MembershipResponse>> ListMyMembershipsAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// FLUXO 1, passo 7 ("criar o Membership") — <paramref name="condominiumId"/>/
    /// <paramref name="unitId"/> já devem vir do resultado de
    /// <c>IInvitationRedemptionService.ValidateInvitationAsync</c> (módulo
    /// Condominium, chamado pela Api antes deste método), nunca de entrada
    /// direta do cliente. O vínculo nasce <c>Active</c> — ver
    /// <c>CondominiumMembership.CreateActiveFromInvitation</c>.
    /// </summary>
    Task<MembershipResponse> CreateMembershipFromInvitationAsync(
        Guid userId,
        Guid condominiumId,
        Guid unitId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// FLUXO 2 ("Não encontrei minha unidade") — <paramref name="condominiumId"/>/
    /// <paramref name="unitId"/> já devem ter sido confirmados por
    /// <c>ICondominiumDirectoryService.ValidateUnitAsync</c> (módulo
    /// Condominium, chamado pela Api antes deste método). O vínculo nasce
    /// <c>Pending</c>, aguardando aprovação administrativa.
    /// </summary>
    Task<MembershipResponse> RequestResidentAccessAsync(
        Guid userId,
        Guid condominiumId,
        Guid unitId,
        CancellationToken cancellationToken = default);
}
