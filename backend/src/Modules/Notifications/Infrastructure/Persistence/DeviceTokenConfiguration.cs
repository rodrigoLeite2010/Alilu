using Alilu.Modules.Notifications.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Notifications.Infrastructure.Persistence;

/// <summary>Mapeamento EF Core de <see cref="DeviceToken"/>. Descoberto dinamicamente por <c>AliluDbContext.OnModelCreating</c>.</summary>
public sealed class DeviceTokenConfiguration : IEntityTypeConfiguration<DeviceToken>
{
    public void Configure(EntityTypeBuilder<DeviceToken> builder)
    {
        builder.ToTable("device_tokens", "notifications");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.UserId).IsRequired();
        builder.Property(t => t.Token).IsRequired().HasMaxLength(500);
        builder.Property(t => t.CreatedAt).IsRequired();
        builder.Property(t => t.UpdatedAt).IsRequired();

        // Um token por usuário (ver nota em DeviceToken) — o upsert de
        // DeviceTokenService depende de haver no máximo uma linha por
        // UserId.
        builder.HasIndex(t => t.UserId).IsUnique();

        builder.Ignore(t => t.DomainEvents);
    }
}
