using Alilu.Modules.Scheduling.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Scheduling.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="BookingItem"/>. Descoberto
/// dinamicamente por <c>AliluDbContext.OnModelCreating</c>.
/// </summary>
public sealed class BookingItemConfiguration : IEntityTypeConfiguration<BookingItem>
{
    public void Configure(EntityTypeBuilder<BookingItem> builder)
    {
        builder.ToTable("booking_items", "scheduling");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.BookingId).IsRequired();
        builder.Property(i => i.ServiceCategoryId).IsRequired();
        builder.Property(i => i.Description).HasMaxLength(500);
        builder.Property(i => i.Quantity).IsRequired();

        // Consulta mais comum: "itens deste agendamento" (compõe BookingResponse).
        builder.HasIndex(i => i.BookingId);

        builder.Ignore(i => i.DomainEvents);
    }
}
