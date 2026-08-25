using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="ProfessionalAvailability"/>. Descoberto
/// dinamicamente por <c>AliluDbContext.OnModelCreating</c>.
/// </summary>
public sealed class ProfessionalAvailabilityConfiguration : IEntityTypeConfiguration<ProfessionalAvailability>
{
    public void Configure(EntityTypeBuilder<ProfessionalAvailability> builder)
    {
        builder.ToTable("professional_availabilities", "professional");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.ProfessionalId).IsRequired();

        // Enum armazenado como texto — mesma decisão dos demais módulos.
        // DayOfWeek é o enum nativo do .NET (System.DayOfWeek), não um
        // tipo próprio deste projeto, mas segue a mesma convenção.
        builder.Property(a => a.DayOfWeek)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        // TimeOnly — horário de parede puro, sem fuso embutido (ver
        // ProfessionalAvailability e ARCHITECTURE.md sobre a decisão de
        // timezone do PROMPT 07). O provider Npgsql mapeia nativamente
        // para a coluna `time` do PostgreSQL desde a v7.
        builder.Property(a => a.StartTime).IsRequired();
        builder.Property(a => a.EndTime).IsRequired();

        builder.Property(a => a.Active).IsRequired();

        // Consulta mais comum: "os intervalos deste profissional, por dia".
        // Sem índice único aqui — "não permitir horários sobrepostos" é uma
        // regra de interseção de intervalos, não uma simples combinação de
        // colunas, então fica só na Application
        // (ProfessionalAvailabilityService.EnsureNoOverlapAsync).
        builder.HasIndex(a => new { a.ProfessionalId, a.DayOfWeek });

        builder.Ignore(a => a.DomainEvents);
    }
}
