using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="ServiceCategory"/>. Descoberto
/// dinamicamente por <c>AliluDbContext.OnModelCreating</c>.
/// </summary>
public sealed class ServiceCategoryConfiguration : IEntityTypeConfiguration<ServiceCategory>
{
    public void Configure(EntityTypeBuilder<ServiceCategory> builder)
    {
        builder.ToTable("service_categories", "professional");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name)
            .HasMaxLength(80)
            .IsRequired();

        // "CATEGORIAS INICIAIS" (PROMPT 06) são únicas por nome — reforça a
        // idempotência do seeder de desenvolvimento (ver ServiceCategorySeeder).
        builder.HasIndex(c => c.Name).IsUnique();

        builder.Property(c => c.Description).HasMaxLength(500);

        builder.Property(c => c.Active).IsRequired();

        builder.Ignore(c => c.DomainEvents);
    }
}
