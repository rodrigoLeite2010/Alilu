namespace Alilu.Modules.Professional.Infrastructure.Seed;

/// <summary>
/// Popula as categorias de profissional (Etapa 22). Só deve ser chamado a
/// partir de <c>Alilu.Api.Program</c> quando <c>app.Environment.IsDevelopment()</c>
/// — nunca em produção (mesmo padrão de <c>IServiceCategorySeeder</c>) — e
/// ANTES de <see cref="IServiceCategorySeeder"/>, já que as especialidades
/// precisam de uma categoria-pai já existente para resolver o
/// <c>CategoryId</c>.
/// </summary>
public interface IProfessionalCategorySeeder
{
    Task SeedAsync(CancellationToken cancellationToken = default);
}
