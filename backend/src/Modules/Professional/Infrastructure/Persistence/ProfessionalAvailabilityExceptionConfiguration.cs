using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="ProfessionalAvailabilityException"/>.
/// Descoberto dinamicamente por <c>AliluDbContext.OnModelCreating</c>.
/// </summary>
public sealed class ProfessionalAvailabilityExceptionConfiguration : IEntityTypeConfiguration<ProfessionalAvailabilityException>
{
    public void Configure(EntityTypeBuilder<ProfessionalAvailabilityException> builder)
    {
        builder.ToTable("professional_availability_exceptions", "professional");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.ProfessionalId).IsRequired();

        // DateOnly — mesma razão de TimeOnly em ProfessionalAvailability:
        // só a data civil, sem horário/fuso embutido. Mapeado para `date`
        // no PostgreSQL (Npgsql, nativo desde a v7).
        builder.Property(e => e.Date).IsRequired();

        // Ambos opcionais, sempre em conjunto (validado na entidade):
        // null+null = dia inteiro (ver ProfessionalAvailabilityException.IsFullDay).
        builder.Property(e => e.StartTime);
        builder.Property(e => e.EndTime);

        builder.Property(e => e.Type)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(e => e.Reason).HasMaxLength(500);

        // Consulta mais comum: "exceções deste profissional nesta data" —
        // usada tanto para listar (BlockedDatesScreen/
        // CalendarAvailabilityScreen) quanto para checar sobreposição antes
        // de criar uma nova.
        builder.HasIndex(e => new { e.ProfessionalId, e.Date });

        builder.Ignore(e => e.DomainEvents);
    }
}
