using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="ProfessionalCategory"/>. Descoberto
/// dinamicamente por <c>AliluDbContext.OnModelCreating</c>.
/// </summary>
public sealed class ProfessionalCategoryConfiguration : IEntityTypeConfiguration<ProfessionalCategory>
{
    public void Configure(EntityTypeBuilder<ProfessionalCategory> builder)
    {
        builder.ToTable("professional_categories", "professional");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name)
            .HasMaxLength(80)
            .IsRequired();

        // Únicas por nome — mesma decisão/motivo de ServiceCategoryConfiguration.
        builder.HasIndex(c => c.Name).IsUnique();

        builder.Property(c => c.Description).HasMaxLength(500);

        builder.Property(c => c.DisplayOrder).IsRequired();

        builder.Property(c => c.Active).IsRequired();

        builder.Ignore(c => c.DomainEvents);
    }
}
