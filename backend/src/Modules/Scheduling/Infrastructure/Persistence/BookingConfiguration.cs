using Alilu.Modules.Scheduling.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Scheduling.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="Booking"/>. Descoberto dinamicamente por
/// <c>AliluDbContext.OnModelCreating</c>.
/// </summary>
public sealed class BookingConfiguration : IEntityTypeConfiguration<Booking>
{
    public void Configure(EntityTypeBuilder<Booking> builder)
    {
        builder.ToTable("bookings", "scheduling");

        builder.HasKey(b => b.Id);

        builder.Property(b => b.ResidentId).IsRequired();
        builder.Property(b => b.ProfessionalId).IsRequired();
        builder.Property(b => b.CondominiumId).IsRequired();
        builder.Property(b => b.UnitId).IsRequired();

        // DateOnly/TimeOnly — mesma decisão de timezone da Etapa 07
        // (ProfessionalAvailability/ProfessionalAvailabilityException):
        // mapeados nativamente para `date`/`time` pelo provider Npgsql.
        builder.Property(b => b.ScheduledDate).IsRequired();
        builder.Property(b => b.StartTime).IsRequired();
        builder.Property(b => b.EndTime).IsRequired();

        // Enum armazenado como texto — mesma decisão dos demais módulos.
        builder.Property(b => b.Status)
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(b => b.Notes).HasMaxLength(1000);

        builder.Property(b => b.CreatedAt).IsRequired();
        builder.Property(b => b.UpdatedAt).IsRequired();

        // Consulta mais comum para checar conflito: "agendamentos deste
        // profissional, nesta data" (ver IBookingRepository.ListHoldingByProfessionalIdAndDateAsync)
        // — não é um índice único porque "não colidir" é uma regra de
        // interseção de horário, não uma simples combinação de colunas
        // (mesmo raciocínio de ProfessionalAvailability na Etapa 07); a
        // exclusão de faixas sobrepostas ficaria a cargo de uma constraint
        // EXCLUDE nativa do PostgreSQL (índice GiST via btree_gist), fora do
        // alcance deste sandbox (exigiria SQL bruto numa migration que não
        // pode ser gerada/validada aqui) — ver ARCHITECTURE.md.
        builder.HasIndex(b => new { b.ProfessionalId, b.ScheduledDate });

        // Consultas de listagem self-service (MyBookingsScreen/ProfessionalRequestsScreen).
        builder.HasIndex(b => b.ResidentId);

        builder.Ignore(b => b.DomainEvents);
    }
}
