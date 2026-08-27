using Alilu.Infrastructure.Persistence;
using Alilu.Modules.Professional.Application;
using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>
/// Implementação de <see cref="IProfessionalRepository"/> usando o
/// <see cref="AliluDbContext"/> compartilhado (raiz).
/// </summary>
public sealed class ProfessionalRepository(AliluDbContext dbContext) : IProfessionalRepository
{
    public Task<Domain.Professional?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        dbContext.Set<Domain.Professional>()
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

    public Task<Domain.Professional?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        dbContext.Set<Domain.Professional>()
            .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);

    public async Task<IReadOnlyList<Domain.Professional>> ListActiveAsync(
        Guid? serviceCategoryId,
        Guid? professionalCategoryId = null,
        string? name = null,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.Set<Domain.Professional>().Where(p => p.Status == ProfessionalStatus.Active);

        if (!string.IsNullOrWhiteSpace(name))
        {
            // Etapa 23 — "buscar profissional pelo nome". ILike (Npgsql) é
            // sem diferenciar maiúsculas/minúsculas e traduz pro operador
            // nativo do Postgres, em vez de baixar tudo pra memória.
            query = query.Where(p => EF.Functions.ILike(p.DisplayName, $"%{name.Trim()}%"));
        }

        if (serviceCategoryId is { } categoryId)
        {
            var professionalIdsWithCategory = dbContext.Set<ProfessionalService>()
                .Where(s => s.Active && s.ServiceCategoryId == categoryId)
                .Select(s => s.ProfessionalId);

            query = query.Where(p => professionalIdsWithCategory.Contains(p.Id));
        }
        else if (professionalCategoryId is { } topCategoryId)
        {
            // Etapa 23 — join de duas tabelas do MESMO módulo (Professional):
            // ServiceCategory.CategoryId (a categoria-pai) -> ProfessionalService
            // (quem oferece aquela especialidade) -> Professional. Cobre "ver
            // todos os profissionais" de dentro de uma categoria-pai, sem
            // exigir uma especialidade específica (ver comentário na
            // interface).
            var serviceCategoryIdsInCategory = dbContext.Set<ServiceCategory>()
                .Where(sc => sc.CategoryId == topCategoryId)
                .Select(sc => sc.Id);

            var professionalIdsWithCategory = dbContext.Set<ProfessionalService>()
                .Where(s => s.Active && serviceCategoryIdsInCategory.Contains(s.ServiceCategoryId))
                .Select(s => s.ProfessionalId);

            query = query.Where(p => professionalIdsWithCategory.Contains(p.Id));
        }

        return await query.OrderBy(p => p.DisplayName).ToListAsync(cancellationToken);
    }

    public async Task AddAsync(Domain.Professional professional, CancellationToken cancellationToken = default) =>
        await dbContext.Set<Domain.Professional>().AddAsync(professional, cancellationToken);
}
