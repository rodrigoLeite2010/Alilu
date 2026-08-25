using Alilu.Modules.Condominium.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Condominium.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="CondominiumInvitation"/>. Descoberto
/// dinamicamente por <c>AliluDbContext.OnModelCreating</c>.
/// </summary>
public sealed class CondominiumInvitationConfiguration : IEntityTypeConfiguration<CondominiumInvitation>
{
    public void Configure(EntityTypeBuilder<CondominiumInvitation> builder)
    {
        builder.ToTable("condominium_invitations", "condominium");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.CondominiumId).IsRequired();
        builder.Property(i => i.UnitId).IsRequired();

        builder.HasIndex(i => i.CondominiumId);
        builder.HasIndex(i => i.UnitId);

        builder.Property(i => i.Email)
            .HasMaxLength(254)
            .IsRequired();

        // Base64 de SHA-256 (32 bytes) = 44 caracteres — 100 dá alguma
        // margem, mesmo espírito de TokenHash em RefreshTokenConfiguration.
        builder.Property(i => i.CodeHash)
            .HasMaxLength(100)
            .IsRequired();

        builder.HasIndex(i => i.CodeHash)
            .IsUnique();

        builder.Property(i => i.ExpiresAt).IsRequired();
        builder.Property(i => i.UsedAt);
        builder.Property(i => i.CreatedAt).IsRequired();

        builder.Ignore(i => i.DomainEvents);
    }
}
