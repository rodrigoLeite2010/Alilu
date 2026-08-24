using Microsoft.EntityFrameworkCore;

namespace Alilu.Infrastructure.Persistence;

/// <summary>
/// DbContext raiz da aplicação.
///
/// Nesta etapa (fundação) o contexto não possui nenhum DbSet: os módulos
/// de negócio (Identity, Condominium, Resident, Professional, Scheduling,
/// Reviews, Recommendations, Notifications, Administration) ainda não
/// foram implementados.
///
/// Quando cada módulo for construído, ele deverá expor suas próprias
/// configurações de entidade (IEntityTypeConfiguration&lt;T&gt;) dentro da
/// camada Infrastructure do módulo, e este método OnModelCreating irá
/// aplicá-las via ApplyConfigurationsFromAssembly — mantendo o DbContext
/// raiz "burro" e sem conhecimento das regras de cada módulo.
/// </summary>
public class AliluDbContext : DbContext
{
    public AliluDbContext(DbContextOptions<AliluDbContext> options)
        : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Datas sempre em UTC (decisão arquitetural do projeto).
        // Convenções e configurações de entidades dos módulos serão
        // aplicadas aqui nas próximas etapas, por exemplo:
        // modelBuilder.ApplyConfigurationsFromAssembly(typeof(AliluDbContext).Assembly);
    }
}
