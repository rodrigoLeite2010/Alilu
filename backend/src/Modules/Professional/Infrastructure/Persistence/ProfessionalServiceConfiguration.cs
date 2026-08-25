using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="ProfessionalService"/>. Descoberto
/// dinamicamente por <c>AliluDbContext.OnModelCreating</c>.
/// </summary>
public sealed class ProfessionalServiceConfiguration : IEntityTypeConfiguration<ProfessionalService>
{
    public void Configure(EntityTypeBuilder<ProfessionalService> builder)
    {
        builder.ToTable("professional_services", "professional");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.ProfessionalId).IsRequired();
        builder.Property(s => s.ServiceCategoryId).IsRequired();

        builder.HasIndex(s => s.ProfessionalId);
        builder.HasIndex(s => s.ServiceCategoryId);

        // "Não permitir serviço duplicado" (mesmo raciocínio do índice
        // único filtrado de CondominiumMembership no módulo Resident) —
        // segunda camada de defesa (a primeira é a checagem em
        // ProfessionalProfileService.AddMyServiceAsync, ver
        // DuplicateProfessionalServiceException): um mesmo profissional não
        // pode ter mais de um serviço Active para a mesma categoria. Índice
        // único FILTRADO (parcial) — de propósito não cobre serviços
        // desativados, para permitir readicionar a mesma categoria depois
        // de removida.
        builder.HasIndex(s => new { s.ProfessionalId, s.ServiceCategoryId })
            .HasFilter("\"Active\" = TRUE")
            .IsUnique();

        builder.Property(s => s.Description).HasMaxLength(500);

        builder.Property(s => s.Active).IsRequired();

        builder.Ignore(s => s.DomainEvents);
    }
}
