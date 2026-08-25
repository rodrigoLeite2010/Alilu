using Alilu.Modules.Resident.Application.Tests.TestDoubles;

namespace Alilu.Modules.Resident.Application.Tests;

/// <summary>
/// Monta <see cref="MembershipService"/>/<see cref="MembershipAdministrationService"/>
/// reais com dependências fake (em memória) — mesmo espírito de
/// CondominiumServiceTestFixture no módulo Condominium.
/// </summary>
internal sealed class MembershipServiceTestFixture
{
    public InMemoryMembershipRepository MembershipRepository { get; } = new();

    public MembershipService CreateSut() => new(MembershipRepository, new NoOpUnitOfWork());

    public MembershipAdministrationService CreateAdministrationSut() => new(MembershipRepository, new NoOpUnitOfWork());
}
