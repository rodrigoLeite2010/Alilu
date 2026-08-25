using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="ProfessionalCondominium"/>. Descoberto
/// dinamicamente por <c>AliluDbContext.OnModelCreating</c>.
/// </summary>
public sealed class ProfessionalCondominiumConfiguration : IEntityTypeConfiguration<ProfessionalCondominium>
{
    public void Configure(EntityTypeBuilder<ProfessionalCondominium> builder)
    {
        builder.ToTable("professional_condominiums", "professional");

        builder.HasKey(pc => pc.Id);

        builder.Property(pc => pc.ProfessionalId).IsRequired();
        builder.Property(pc => pc.CondominiumId).IsRequired();

        builder.HasIndex(pc => pc.ProfessionalId);
        builder.HasIndex(pc => pc.CondominiumId);

        builder.Property(pc => pc.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(pc => pc.Source)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        // "Não permitir vínculo duplicado" — mesmo padrão do índice único
        // filtrado de CondominiumMembership (módulo Resident) e de
        // ProfessionalService acima: um mesmo profissional não pode ter
        // mais de um vínculo Pending/Active com o mesmo condomínio ao
        // mesmo tempo.
        builder.HasIndex(pc => new { pc.ProfessionalId, pc.CondominiumId })
            .HasFilter("\"Status\" IN ('Pending','Active')")
            .IsUnique();

        builder.Property(pc => pc.CreatedAt).IsRequired();

        builder.Ignore(pc => pc.DomainEvents);
    }
}
