using Alilu.Modules.Mural.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Mural.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="MuralPost"/>. Descoberto
/// dinamicamente por <c>AliluDbContext.OnModelCreating</c>.
/// </summary>
public sealed class MuralPostConfiguration : IEntityTypeConfiguration<MuralPost>
{
    public void Configure(EntityTypeBuilder<MuralPost> builder)
    {
        builder.ToTable("mural_posts", "mural");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.CondominiumId).IsRequired();
        builder.Property(p => p.AuthorUserId).IsRequired();

        builder.Property(p => p.Type).IsRequired().HasConversion<string>().HasMaxLength(30);

        builder.Property(p => p.Content).IsRequired().HasMaxLength(MuralPost.MaxContentLength);

        builder.Property(p => p.Status).IsRequired().HasConversion<string>().HasMaxLength(20);

        builder.Property(p => p.CreatedAt).IsRequired();
        builder.Property(p => p.BlockedAt);
        builder.Property(p => p.BlockedBy);

        // Feed do condomínio (MuralScreen) e moderação (admin-web) — ambos
        // filtram por CondominiumId; a listagem do morador também filtra
        // por Status (Visible) e por AuthorUserId (post bloqueado do
        // próprio autor continua aparecendo — ver
        // IMuralPostRepository.ListForResidentFeedAsync).
        builder.HasIndex(p => new { p.CondominiumId, p.Status });
        builder.HasIndex(p => new { p.CondominiumId, p.AuthorUserId });

        builder.Ignore(p => p.DomainEvents);
    }
}
