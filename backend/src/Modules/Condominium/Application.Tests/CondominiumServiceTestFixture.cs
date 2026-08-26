using Alilu.Modules.Condominium.Application.Tests.TestDoubles;
using Alilu.Modules.Condominium.Domain;

namespace Alilu.Modules.Condominium.Application.Tests;

/// <summary>
/// Monta um <see cref="CondominiumService"/> real com dependências fake
/// (em memória) — exceto <see cref="IInvitationCodeGenerator"/>, que usa a
/// implementação real de Domain (só BCL, barata), porque é justamente esse
/// comportamento (geração/hash do código) que os testes de convite querem
/// exercitar de verdade. Mesmo espírito de AuthServiceTestFixture no
/// módulo Identity.
/// </summary>
internal sealed class CondominiumServiceTestFixture
{
    public InMemoryCondominiumRepository CondominiumRepository { get; } = new();

    public InMemoryCondominiumUnitRepository UnitRepository { get; } = new();

    public InMemoryCondominiumInvitationRepository InvitationRepository { get; } = new();

    public IInvitationCodeGenerator InvitationCodeGenerator { get; } = new InvitationCodeGenerator();

    public CondominiumOptions Options { get; init; } = new() { DefaultInvitationExpirationDays = 7 };

    public CondominiumService CreateSut() => new(
        CondominiumRepository,
        UnitRepository,
        InvitationRepository,
        InvitationCodeGenerator,
        new NoOpUnitOfWork(),
        Options);

    /// <summary>PROMPT 05 — SUT do resgate de convite (self-service, sem checagem de papel).</summary>
    public InvitationRedemptionService CreateInvitationRedemptionSut() =>
        new(InvitationRepository, InvitationCodeGenerator, new NoOpUnitOfWork());

    /// <summary>PROMPT 05 — SUT do diretório público de condomínios/unidades.</summary>
    public CondominiumDirectoryService CreateDirectorySut() =>
        new(CondominiumRepository, UnitRepository);

    /// <summary>
    /// Atalho para os testes que precisam de um condomínio já cadastrado
    /// antes do cenário sob teste. <paramref name="requesterRole"/> default
    /// é <c>SuperAdmin</c> desde a Etapa 12 — "criar condomínio" deixou de
    /// aceitar <c>CondominiumAdmin</c> (ver <c>CondominiumService.EnsureIsSuperAdmin</c>);
    /// os testes que exercitam esse caso específico passam
    /// <c>requesterRole</c> explicitamente.
    /// </summary>
    public Task<CondominiumResponse> RegisterCondominiumAsync(
        CondominiumService sut,
        string name = "Monte Carlo",
        string cnpj = "11222333000181",
        CondominiumRequesterRole requesterRole = CondominiumRequesterRole.SuperAdmin)
    {
        return sut.CreateCondominiumAsync(
            requesterRole,
            new CreateCondominiumRequest(
                name,
                cnpj,
                "Rua das Palmeiras",
                "500",
                "Jardim das Flores",
                "São Paulo",
                "SP",
                "01234000"));
    }

    /// <summary>Atalho para os testes que precisam de uma unidade já cadastrada antes do cenário sob teste.</summary>
    public Task<CondominiumUnitResponse> RegisterUnitAsync(
        CondominiumService sut,
        Guid condominiumId,
        string code = "101",
        UnitType type = UnitType.Apartment,
        CondominiumRequesterRole requesterRole = CondominiumRequesterRole.CondominiumAdmin)
    {
        return sut.CreateUnitAsync(requesterRole, new CreateUnitRequest(condominiumId, code, type));
    }
}
