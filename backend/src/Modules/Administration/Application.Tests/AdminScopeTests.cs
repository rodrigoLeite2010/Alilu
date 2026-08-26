using Xunit;

namespace Alilu.Modules.Administration.Application.Tests;

/// <summary>Cobre <see cref="AdminScope"/> — <c>CanAccess</c>/<c>EnsureCanAccess</c>, usado pela Api para checar o escopo reaproveitando uma entidade já buscada por outro módulo (ver ARCHITECTURE.md, "Etapa 12").</summary>
public sealed class AdminScopeTests
{
    [Fact]
    public void CanAccess_GlobalScope_AlwaysTrue()
    {
        var scope = new AdminScope(Guid.NewGuid(), null);

        Assert.True(scope.CanAccess(Guid.NewGuid()));
        Assert.True(scope.CanAccess(Guid.NewGuid()));
    }

    [Fact]
    public void CanAccess_ScopedToOwnCondominium_TrueOnlyForThatCondominium()
    {
        var condominiumId = Guid.NewGuid();
        var scope = new AdminScope(Guid.NewGuid(), condominiumId);

        Assert.True(scope.CanAccess(condominiumId));
        Assert.False(scope.CanAccess(Guid.NewGuid()));
    }

    [Fact]
    public void EnsureCanAccess_OutOfScope_ThrowsExceptionFromFactory()
    {
        var scope = new AdminScope(Guid.NewGuid(), Guid.NewGuid());

        Assert.Throws<InvalidOperationException>(
            () => scope.EnsureCanAccess(Guid.NewGuid(), () => new InvalidOperationException("fora de escopo")));
    }

    [Fact]
    public void EnsureCanAccess_InScope_DoesNotThrow()
    {
        var condominiumId = Guid.NewGuid();
        var scope = new AdminScope(Guid.NewGuid(), condominiumId);

        var exception = Record.Exception(
            () => scope.EnsureCanAccess(condominiumId, () => new InvalidOperationException("não deveria lançar")));

        Assert.Null(exception);
    }
}
