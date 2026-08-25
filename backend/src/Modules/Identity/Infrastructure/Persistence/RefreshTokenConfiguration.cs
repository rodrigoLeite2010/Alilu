using Alilu.Modules.Identity.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Identity.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="RefreshToken"/>. Descoberto
/// dinamicamente por <c>AliluDbContext.OnModelCreating</c> — ver
/// <see cref="UserConfiguration"/>.
/// </summary>
public sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("refresh_tokens", "identity");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.UserId)
            .IsRequired();

        // Toda consulta por token passa pelo hash (nunca por Id) — ver
        // RefreshTokenRepository. É a chave de busca mais quente da tabela,
        // por isso é única e indexada.
        builder.Property(t => t.TokenHash)
            .HasMaxLength(200)
            .IsRequired();

        builder.HasIndex(t => t.TokenHash)
            .IsUnique();

        // Índice para "revogar todos os tokens de um usuário" (logout de
        // todas as sessões) — caso de uso de uma etapa futura, mas o índice
        // já é barato e correto de criar agora.
        builder.HasIndex(t => t.UserId);

        builder.Property(t => t.ExpiresAt).IsRequired();
        builder.Property(t => t.RevokedAt);
        builder.Property(t => t.CreatedAt).IsRequired();

        // RefreshToken é sua própria raiz de agregado (ver comentário em
        // Domain/RefreshToken.cs) — de propósito NÃO há navegação/FK para
        // User aqui, só o UserId como valor simples.
        builder.Ignore(t => t.DomainEvents);
    }
}
