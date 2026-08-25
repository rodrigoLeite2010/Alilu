using Alilu.Modules.Condominium.Domain;
using Alilu.Shared;

namespace Alilu.Modules.Condominium.Application;

/// <summary>
/// Orquestra os 6 casos de uso administrativos deste módulo. Esta classe
/// não sabe nada de HTTP, EF Core ou JWT — apenas das portas (interfaces)
/// que injeta, mesmo espírito de <c>AuthService</c> no módulo Identity.
///
/// Toda operação começa com <c>EnsureIsAdmin</c>: a primeira linha de
/// defesa é <c>[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]</c> no
/// controller (ver Api), mas esta segunda camada aqui garante a regra
/// mesmo que a Application seja chamada de outro lugar no futuro (ex.: um
/// job, um outro módulo) — e é o que permite testar "autorização" sem
/// precisar de um host HTTP real (ver Application.Tests).
/// </summary>
public sealed class CondominiumService(
    ICondominiumRepository condominiumRepository,
    ICondominiumUnitRepository unitRepository,
    ICondominiumInvitationRepository invitationRepository,
    IInvitationCodeGenerator invitationCodeGenerator,
    IUnitOfWork unitOfWork,
    CondominiumOptions options) : ICondominiumService
{
    public async Task<CondominiumResponse> CreateCondominiumAsync(
        CondominiumRequesterRole requesterRole,
        CreateCondominiumRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var cnpj = Cnpj.Create(request.Cnpj);
        if (await condominiumRepository.ExistsByCnpjAsync(cnpj.Value, cancellationToken))
        {
            throw new CnpjAlreadyInUseException();
        }

        var condominium = Domain.Condominium.Register(
            request.Name,
            cnpj,
            request.Address,
            request.Number,
            request.Neighborhood,
            request.City,
            request.State,
            request.ZipCode);

        await condominiumRepository.AddAsync(condominium, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ToResponse(condominium);
    }

    public async Task<IReadOnlyList<CondominiumResponse>> ListCondominiumsAsync(
        CondominiumRequesterRole requesterRole,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var condominiums = await condominiumRepository.ListAsync(cancellationToken);
        return condominiums.Select(ToResponse).ToList();
    }

    public async Task<CondominiumUnitResponse> CreateUnitAsync(
        CondominiumRequesterRole requesterRole,
        CreateUnitRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var condominium = await condominiumRepository.GetByIdAsync(request.CondominiumId, cancellationToken)
            ?? throw new CondominiumNotFoundException();

        var normalizedCode = request.Code.Trim();
        if (await unitRepository.ExistsByCondominiumIdAndCodeAsync(condominium.Id, normalizedCode, cancellationToken))
        {
            throw new DuplicateUnitCodeException();
        }

        var unit = CondominiumUnit.Register(condominium.Id, normalizedCode, request.Type);

        await unitRepository.AddAsync(unit, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ToResponse(unit);
    }

    public async Task<IReadOnlyList<CondominiumUnitResponse>> ListUnitsAsync(
        CondominiumRequesterRole requesterRole,
        Guid condominiumId,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        _ = await condominiumRepository.GetByIdAsync(condominiumId, cancellationToken)
            ?? throw new CondominiumNotFoundException();

        var units = await unitRepository.ListByCondominiumIdAsync(condominiumId, cancellationToken);
        return units.Select(ToResponse).ToList();
    }

    public async Task<CondominiumInvitationCreatedResponse> CreateInvitationAsync(
        CondominiumRequesterRole requesterRole,
        CreateInvitationRequest request,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var condominium = await condominiumRepository.GetByIdAsync(request.CondominiumId, cancellationToken)
            ?? throw new CondominiumNotFoundException();

        var unit = await unitRepository.GetByIdAsync(request.UnitId, cancellationToken)
            ?? throw new CondominiumUnitNotFoundException();

        if (unit.CondominiumId != condominium.Id)
        {
            throw new UnitDoesNotBelongToCondominiumException();
        }

        var expirationDays = request.ExpirationDays.GetValueOrDefault(options.DefaultInvitationExpirationDays);
        if (expirationDays <= 0)
        {
            expirationDays = options.DefaultInvitationExpirationDays;
        }

        var expiresAtUtc = DateTime.UtcNow.AddDays(expirationDays);
        var (rawCode, codeHash) = invitationCodeGenerator.Generate();

        var invitation = CondominiumInvitation.Create(condominium.Id, unit.Id, request.Email, codeHash, expiresAtUtc);

        await invitationRepository.AddAsync(invitation, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new CondominiumInvitationCreatedResponse(
            invitation.Id,
            invitation.CondominiumId,
            invitation.UnitId,
            invitation.Email,
            rawCode,
            invitation.ExpiresAt,
            invitation.CreatedAt);
    }

    public async Task<CondominiumInvitationResponse> GetInvitationAsync(
        CondominiumRequesterRole requesterRole,
        Guid invitationId,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var invitation = await invitationRepository.GetByIdAsync(invitationId, cancellationToken)
            ?? throw new CondominiumInvitationNotFoundException();

        return ToResponse(invitation);
    }

    private static void EnsureIsAdmin(CondominiumRequesterRole requesterRole)
    {
        if (requesterRole is not (CondominiumRequesterRole.CondominiumAdmin or CondominiumRequesterRole.SuperAdmin))
        {
            throw new InsufficientPermissionsException();
        }
    }

    private static CondominiumResponse ToResponse(Domain.Condominium condominium) => new(
        condominium.Id,
        condominium.Name,
        condominium.Cnpj.Value,
        condominium.Address,
        condominium.Number,
        condominium.Neighborhood,
        condominium.City,
        condominium.State,
        condominium.ZipCode,
        condominium.Status,
        condominium.CreatedAt);

    private static CondominiumUnitResponse ToResponse(CondominiumUnit unit) => new(
        unit.Id,
        unit.CondominiumId,
        unit.Code,
        unit.Type,
        unit.Status,
        unit.CreatedAt);

    private static CondominiumInvitationResponse ToResponse(CondominiumInvitation invitation)
    {
        var status = invitation.IsUsed
            ? InvitationStatus.Used
            : invitation.IsExpired
                ? InvitationStatus.Expired
                : InvitationStatus.Pending;

        return new CondominiumInvitationResponse(
            invitation.Id,
            invitation.CondominiumId,
            invitation.UnitId,
            invitation.Email,
            status,
            invitation.ExpiresAt,
            invitation.UsedAt,
            invitation.CreatedAt);
    }
}
