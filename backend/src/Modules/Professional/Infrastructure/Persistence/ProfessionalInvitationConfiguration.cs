using Alilu.Modules.Professional.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Professional.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="ProfessionalInvitation"/>. Descoberto
/// dinamicamente por <c>AliluDbContext.OnModelCreating</c>.
/// </summary>
public sealed class ProfessionalInvitationConfiguration : IEntityTypeConfiguration<ProfessionalInvitation>
{
    public void Configure(EntityTypeBuilder<ProfessionalInvitation> builder)
    {
        builder.ToTable("professional_invitations", "professional");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.CondominiumId).IsRequired();
        builder.Property(i => i.InvitedByUserId).IsRequired();

        builder.Property(i => i.Name).IsRequired().HasMaxLength(ProfessionalInvitation.MaxNameLength);
        builder.Property(i => i.Phone).IsRequired().HasMaxLength(ProfessionalInvitation.MaxPhoneLength);
        builder.Property(i => i.Email).HasMaxLength(ProfessionalInvitation.MaxEmailLength);

        builder.Property(i => i.CreatedAt).IsRequired();
        builder.Property(i => i.WhatsAppDelivered).IsRequired();
        builder.Property(i => i.SmsDelivered).IsRequired();
        builder.Property(i => i.EmailDelivered);

        // "Limite de envio" (CountByInvitedByUserIdSinceAsync) e histórico
        // self-service ("convites enviados") — ambos filtram por
        // InvitedByUserId, mais recente primeiro.
        builder.HasIndex(i => new { i.InvitedByUserId, i.CreatedAt });

        builder.Ignore(i => i.DomainEvents);
    }
}
