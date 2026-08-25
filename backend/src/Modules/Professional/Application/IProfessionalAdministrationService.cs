namespace Alilu.Modules.Professional.Application;

/// <summary>
/// Casos de uso administrativos deste módulo — decidir sobre solicitações
/// de atendimento a um condomínio (React Native, profissional:
/// "solicitar atendimento em condomínios"; alguém precisa aprovar/rejeitar
/// essa fila, mesmo raciocínio de
/// <c>Alilu.Modules.Resident.Application.IMembershipAdministrationService</c>
/// para o FLUXO 2 de solicitação de acesso). Toda operação aqui começa com
/// uma checagem de papel (<c>EnsureIsAdmin</c>), mesmo padrão dos demais
/// módulos.
/// </summary>
public interface IProfessionalAdministrationService
{
    /// <summary>Fila de solicitações aguardando decisão.</summary>
    Task<IReadOnlyList<ProfessionalCondominiumResponse>> ListPendingCondominiumRequestsAsync(
        ProfessionalRequesterRole requesterRole,
        CancellationToken cancellationToken = default);

    Task<ProfessionalCondominiumResponse> ApproveCondominiumAsync(
        ProfessionalRequesterRole requesterRole,
        Guid professionalCondominiumId,
        CancellationToken cancellationToken = default);

    Task<ProfessionalCondominiumResponse> RejectCondominiumAsync(
        ProfessionalRequesterRole requesterRole,
        Guid professionalCondominiumId,
        CancellationToken cancellationToken = default);
}
