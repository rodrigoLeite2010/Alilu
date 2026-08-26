using Alilu.Modules.Recommendations.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Recommendations.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="Recommendation"/>. Descoberto
/// dinamicamente por <c>AliluDbContext.OnModelCreating</c>.
/// </summary>
public sealed class RecommendationConfiguration : IEntityTypeConfiguration<Recommendation>
{
    public void Configure(EntityTypeBuilder<Recommendation> builder)
    {
        builder.ToTable("recommendations", "recommendations");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.CondominiumId).IsRequired();
        builder.Property(r => r.RecommendedByUserId).IsRequired();

        // ProfessionalId/ExternalProfessionalName/ExternalPhone: exatamente
        // um entre ProfessionalId e ExternalProfessionalName é preenchido
        // (XOR garantido pelo Domain, Recommendation.Recommend) — por isso
        // nenhum dos três é IsRequired aqui.
        builder.Property(r => r.ProfessionalId);
        builder.Property(r => r.ExternalProfessionalName).HasMaxLength(200);
        builder.Property(r => r.ExternalPhone).HasMaxLength(30);

        builder.Property(r => r.ServiceCategoryId).IsRequired();
        builder.Property(r => r.Comment).IsRequired().HasMaxLength(1000);

        builder.Property(r => r.Status).IsRequired().HasConversion<string>().HasMaxLength(20);

        builder.Property(r => r.CreatedAt).IsRequired();
        builder.Property(r => r.ApprovedAt);
        builder.Property(r => r.ApprovedBy);

        // Consultas de listagem self-service (RecommendationsScreen "minhas
        // recomendações") e a checagem de spam ("não permitir spam
        // ilimitado").
        builder.HasIndex(r => r.RecommendedByUserId);

        // Fila de moderação do administrador ("Administrador pode
        // moderar") e o "Recomendado por N moradores" público — ambas
        // filtram por Status, a segunda também por ProfessionalId.
        builder.HasIndex(r => r.Status);
        builder.HasIndex(r => new { r.ProfessionalId, r.Status });

        builder.Ignore(r => r.DomainEvents);
    }
}
