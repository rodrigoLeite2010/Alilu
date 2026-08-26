using Alilu.Modules.Notifications.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Notifications.Infrastructure.Persistence;

/// <summary>Mapeamento EF Core de <see cref="Notification"/>. Descoberto dinamicamente por <c>AliluDbContext.OnModelCreating</c>.</summary>
public sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("notifications", "notifications");

        builder.HasKey(n => n.Id);

        builder.Property(n => n.UserId).IsRequired();
        builder.Property(n => n.Title).IsRequired().HasMaxLength(200);
        builder.Property(n => n.Message).IsRequired().HasMaxLength(1000);
        builder.Property(n => n.Type).IsRequired().HasConversion<string>().HasMaxLength(30);
        builder.Property(n => n.ReferenceId);
        builder.Property(n => n.ReadAt);
        builder.Property(n => n.CreatedAt).IsRequired();

        // NotificationCenter ("minhas notificações", mais recente primeiro)
        // e NotificationBadge (contagem não lida) — ambas filtram por
        // UserId; a segunda também por ReadAt (IS NULL).
        builder.HasIndex(n => n.UserId);
        builder.HasIndex(n => new { n.UserId, n.ReadAt });

        // REGRA "não enviar notificações duplicadas" —
        // INotificationRepository.ExistsAsync consulta exatamente esta
        // combinação antes de qualquer inserção.
        builder.HasIndex(n => new { n.UserId, n.Type, n.ReferenceId });

        builder.Ignore(n => n.DomainEvents);
    }
}
