namespace Alilu.Modules.Condominium.Application;

public interface ICondominiumService
{
    Task<CondominiumResponse> CreateCondominiumAsync(
        CondominiumRequesterRole requesterRole,
        CreateCondominiumRequest request,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CondominiumResponse>> ListCondominiumsAsync(
        CondominiumRequesterRole requesterRole,
        CancellationToken cancellationToken = default);

    Task<CondominiumUnitResponse> CreateUnitAsync(
        CondominiumRequesterRole requesterRole,
        CreateUnitRequest request,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CondominiumUnitResponse>> ListUnitsAsync(
        CondominiumRequesterRole requesterRole,
        Guid condominiumId,
        CancellationToken cancellationToken = default);

    Task<CondominiumInvitationCreatedResponse> CreateInvitationAsync(
        CondominiumRequesterRole requesterRole,
        CreateInvitationRequest request,
        CancellationToken cancellationToken = default);

    Task<CondominiumInvitationResponse> GetInvitationAsync(
        CondominiumRequesterRole requesterRole,
        Guid invitationId,
        CancellationToken cancellationToken = default);
}
