using Alilu.Modules.Condominium.Domain;
using Alilu.Shared;

namespace Alilu.Modules.Condominium.Application;

/// <summary>
/// Orquestra os casos de uso administrativos deste módulo. Esta classe não
/// sabe nada de HTTP, EF Core ou JWT — apenas das portas (interfaces) que
/// injeta, mesmo espírito de <c>AuthService</c> no módulo Identity.
///
/// Toda operação começa com <c>EnsureIsAdmin</c> (ou <c>EnsureIsSuperAdmin</c>
/// — ver <see cref="CreateCondominiumAsync"/>): a primeira linha de defesa é
/// <c>[Authorize(Roles = "CondominiumAdmin,SuperAdmin")]</c> no controller
/// (ver Api), mas esta segunda camada aqui garante a regra mesmo que a
/// Application seja chamada de outro lugar no futuro — e é o que permite
/// testar "autorização" sem precisar de um host HTTP real (ver
/// Application.Tests).
///
/// Etapa 12 (PROMPT 12, AUTORIZAÇÃO) acrescentou <c>scopeCondominiumId</c> a
/// cada operação — resolvido pela Api via
/// <c>Administration.Application.IAdminScopeService</c> (nunca confiando no
/// que o frontend envia) e checado aqui via <see cref="EnsureScopeMatches"/>,
/// reaproveitando a entidade que o próprio método já buscou (zero query
/// extra). Parâmetro opcional (nulo = sem restrição, comportamento das
/// etapas anteriores) para não quebrar nenhum chamador existente — SuperAdmin
/// sempre passa nulo.
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
        EnsureIsSuperAdmin(requesterRole);

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
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        if (scopeCondominiumId is not null)
        {
            var scopedCondominium = await condominiumRepository.GetByIdAsync(scopeCondominiumId.Value, cancellationToken)
                ?? throw new CondominiumNotFoundException();

            return new List<CondominiumResponse> { ToResponse(scopedCondominium) };
        }

        var condominiums = await condominiumRepository.ListAsync(cancellationToken);
        return condominiums.Select(ToResponse).ToList();
    }

    public async Task<CondominiumUnitResponse> CreateUnitAsync(
        CondominiumRequesterRole requesterRole,
        CreateUnitRequest request,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var condominium = await condominiumRepository.GetByIdAsync(request.CondominiumId, cancellationToken)
            ?? throw new CondominiumNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, condominium.Id);

        var normalizedCode = request.Code.Trim();
        if (await unitRepository.ExistsByCondominiumIdAndCodeAsync(condominium.Id, normalizedCode, excludingUnitId: null, cancellationToken))
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
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        _ = await condominiumRepository.GetByIdAsync(condominiumId, cancellationToken)
            ?? throw new CondominiumNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, condominiumId);

        var units = await unitRepository.ListByCondominiumIdAsync(condominiumId, cancellationToken);
        return units.Select(ToResponse).ToList();
    }

    public async Task<CondominiumUnitResponse> GetUnitAsync(
        CondominiumRequesterRole requesterRole,
        Guid unitId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var unit = await unitRepository.GetByIdAsync(unitId, cancellationToken)
            ?? throw new CondominiumUnitNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, unit.CondominiumId);

        return ToResponse(unit);
    }

    public async Task<CondominiumUnitResponse> EditUnitAsync(
        CondominiumRequesterRole requesterRole,
        EditUnitRequest request,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var unit = await unitRepository.GetByIdAsync(request.UnitId, cancellationToken)
            ?? throw new CondominiumUnitNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, unit.CondominiumId);

        var normalizedCode = request.Code.Trim();
        if (await unitRepository.ExistsByCondominiumIdAndCodeAsync(unit.CondominiumId, normalizedCode, excludingUnitId: unit.Id, cancellationToken))
        {
            throw new DuplicateUnitCodeException();
        }

        unit.Edit(normalizedCode, request.Type);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ToResponse(unit);
    }

    public async Task<CondominiumUnitResponse> BlockUnitAsync(
        CondominiumRequesterRole requesterRole,
        Guid unitId,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var unit = await unitRepository.GetByIdAsync(unitId, cancellationToken)
            ?? throw new CondominiumUnitNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, unit.CondominiumId);

        unit.Deactivate();
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return ToResponse(unit);
    }

    public async Task<CondominiumInvitationCreatedResponse> CreateInvitationAsync(
        CondominiumRequesterRole requesterRole,
        CreateInvitationRequest request,
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var condominium = await condominiumRepository.GetByIdAsync(request.CondominiumId, cancellationToken)
            ?? throw new CondominiumNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, condominium.Id);

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
        Guid? scopeCondominiumId = null,
        CancellationToken cancellationToken = default)
    {
        EnsureIsAdmin(requesterRole);

        var invitation = await invitationRepository.GetByIdAsync(invitationId, cancellationToken)
            ?? throw new CondominiumInvitationNotFoundException();

        EnsureScopeMatches(scopeCondominiumId, invitation.CondominiumId);

        return ToResponse(invitation);
    }

    private static void EnsureIsAdmin(CondominiumRequesterRole requesterRole)
    {
        if (requesterRole is not (CondominiumRequesterRole.CondominiumAdmin or CondominiumRequesterRole.SuperAdmin))
        {
            throw new InsufficientPermissionsException();
        }
    }

    /// <summary>
    /// Etapa 12 (PROMPT 12, AUTORIZAÇÃO): "criar um NOVO condomínio" deixou
    /// de ser CondominiumAdmin-ou-SuperAdmin (Etapa 04) e passou a ser
    /// SOMENTE SuperAdmin — não se encaixa em "CondominiumAdmin somente pode
    /// administrar seu próprio condomínio" (que pressupõe um condomínio já
    /// existente, ao qual o admin já foi vinculado). Mudança de
    /// comportamento explícita, documentada em ARCHITECTURE.md e no README
    /// deste módulo.
    /// </summary>
    private static void EnsureIsSuperAdmin(CondominiumRequesterRole requesterRole)
    {
        if (requesterRole != CondominiumRequesterRole.SuperAdmin)
        {
            throw new InsufficientPermissionsException();
        }
    }

    /// <summary>
    /// "CondominiumAdmin somente pode administrar seu próprio condomínio"
    /// (PROMPT 12) — <paramref name="scopeCondominiumId"/> nulo (SuperAdmin)
    /// sempre passa; não-nulo só passa se igual a
    /// <paramref name="targetCondominiumId"/>. Resolvido pela Api via
    /// <c>Administration.IAdminScopeService</c> antes de chamar este módulo
    /// ("nunca confiar no condominiumId enviado pelo frontend").
    /// </summary>
    private static void EnsureScopeMatches(Guid? scopeCondominiumId, Guid targetCondominiumId)
    {
        if (scopeCondominiumId is not null && scopeCondominiumId.Value != targetCondominiumId)
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
