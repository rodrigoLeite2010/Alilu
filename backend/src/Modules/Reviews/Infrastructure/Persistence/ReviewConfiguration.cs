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

        // Etapa 23: BookingId passou de obrigatório para opcional (avaliação
        // LIVRE, sem agendamento — ver comentário na entidade Review).
        builder.Property(r => r.BookingId);
        builder.Property(r => r.ResidentId).IsRequired();
        builder.Property(r => r.ProfessionalId).IsRequired();

        builder.Property(r => r.Rating).IsRequired();
        builder.Property(r => r.Comment).HasMaxLength(1000);

        builder.Property(r => r.CreatedAt).IsRequired();

        // "Somente uma Review por Booking" (REGRA CRÍTICA) — índice único
        // SEM filtro, diferente de MembershipConfiguration.HasIndex (Etapa
        // 06), porque lá "sem duplicata Pending/Active" permite nova
        // tentativa depois de uma rejeição; aqui a regra é incondicional —
        // um Booking avaliado uma vez nunca pode ser avaliado de novo. Um
        // índice único do Postgres ignora linhas com a coluna nula por
        // padrão, então isto não afeta as avaliações livres (BookingId
        // nulo) abaixo.
        builder.HasIndex(r => r.BookingId).IsUnique();

        // Etapa 23 — "somente uma avaliação LIVRE por (Resident,
        // Professional)": índice único FILTRADO (parcial), mesmo padrão de
        // MembershipConfiguration.HasIndex — só se aplica às linhas de
        // avaliação livre (BookingId nulo); uma avaliação amarrada a um
        // Booking nunca conta pra essa unicidade. As aspas duplas são
        // necessárias porque este projeto não usa nenhuma convenção de
        // nomes do EF Core — os nomes de coluna ficam exatamente como estão
        // em C# (PascalCase).
        builder.HasIndex(r => new { r.ResidentId, r.ProfessionalId })
            .HasFilter(""BookingId" IS NULL")
            .IsUnique();

        // Consultas de listagem self-service (ReviewScreen "avaliações
        // feitas" / ProfessionalReviewsScreen "avaliações recebidas").
        builder.HasIndex(r => r.ResidentId);
        builder.HasIndex(r => r.ProfessionalId);

        builder.Ignore(r => r.DomainEvents);
    }
}
