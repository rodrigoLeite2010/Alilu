using Microsoft.EntityFrameworkCore;

namespace Alilu.Infrastructure.Persistence;

/// <summary>
/// DbContext raiz da aplicação.
///
/// Módulos de negócio (Identity implementado; Condominium, Resident,
/// Professional, Scheduling, Reviews, Recommendations, Notifications,
/// Administration ainda não) expõem suas próprias configurações de
/// entidade (IEntityTypeConfiguration&lt;T&gt;) dentro da camada
/// Infrastructure do módulo. Este DbContext raiz não referencia nenhum
/// módulo — ele descobre e aplica essas configurações dinamicamente em
/// tempo de execução (ver <see cref="OnModelCreating"/>), permanecendo
/// "burro" e sem conhecimento das regras de cada módulo.
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

        // Cada módulo referencia este projeto (Alilu.Infrastructure) a
        // partir da sua própria camada Infrastructure — nunca o contrário —
        // então, quando a Api sobe, o assembly de cada módulo já está
        // carregado no processo. Escaneamos os assemblies carregados cujo
        // nome começa com "Alilu." (evita examinar bibliotecas de terceiros
        // carregadas no mesmo processo) e aplicamos as configurações de
        // entidade encontradas em cada um. Isso mantém o DbContext raiz sem
        // nenhuma referência de projeto para dentro de um módulo.
        var aliluAssemblies = AppDomain.CurrentDomain.GetAssemblies()
            .Where(assembly => assembly.GetName().Name?.StartsWith("Alilu.", StringComparison.Ordinal) == true);

        foreach (var assembly in aliluAssemblies)
        {
            modelBuilder.ApplyConfigurationsFromAssembly(assembly);
        }
    }
}
