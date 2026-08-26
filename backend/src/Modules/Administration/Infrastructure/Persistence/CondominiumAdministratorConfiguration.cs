using Alilu.Modules.Administration.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Administration.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="CondominiumAdministrator"/>. Descoberto
/// dinamicamente por <c>AliluDbContext.OnModelCreating</c>.
/// </summary>
public sealed class CondominiumAdministratorConfiguration : IEntityTypeConfiguration<CondominiumAdministrator>
{
    public void Configure(EntityTypeBuilder<CondominiumAdministrator> builder)
    {
        builder.ToTable("condominium_administrators", "administration");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.UserId).IsRequired();
        builder.Property(a => a.CondominiumId).IsRequired();
        builder.Property(a => a.CreatedAt).IsRequired();
        builder.Property(a => a.UpdatedAt).IsRequired();

        // "Um condomínio por administrador" (decisão de escopo, ver Domain)
        // — único por UserId, base de ResolveScopeAsync/AssignAsync (upsert).
        builder.HasIndex(a => a.UserId).IsUnique();

        builder.Ignore(a => a.DomainEvents);
    }
}
