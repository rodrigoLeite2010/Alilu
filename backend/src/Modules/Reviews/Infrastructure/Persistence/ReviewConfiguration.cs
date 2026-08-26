using Alilu.Modules.Reviews.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Reviews.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="Review"/>. Descoberto dinamicamente por
/// <c>AliluDbContext.OnModelCreating</c>.
/// </summary>
public sealed class ReviewConfiguration : IEntityTypeConfiguration<Review>
{
    public void Configure(EntityTypeBuilder<Review> builder)
    {
        builder.ToTable("reviews", "reviews");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.BookingId).IsRequired();
        builder.Property(r => r.ResidentId).IsRequired();
        builder.Property(r => r.ProfessionalId).IsRequired();

        builder.Property(r => r.Rating).IsRequired();
        builder.Property(r => r.Comment).HasMaxLength(1000);

        builder.Property(r => r.CreatedAt).IsRequired();

        // "Somente uma Review por Booking" (REGRA CRÍTICA) — índice único
        // SEM filtro, diferente de MembershipConfiguration.HasIndex (Etapa
        // 06), porque lá "sem duplicata Pending/Active" permite nova
        // tentativa depois de uma rejeição; aqui a regra é incondicional —
        // um Booking avaliado uma vez nunca pode ser avaliado de novo.
        builder.HasIndex(r => r.BookingId).IsUnique();

        // Consultas de listagem self-service (ReviewScreen "avaliações
        // feitas" / ProfessionalReviewsScreen "avaliações recebidas").
        builder.HasIndex(r => r.ResidentId);
        builder.HasIndex(r => r.ProfessionalId);

        builder.Ignore(r => r.DomainEvents);
    }
}
