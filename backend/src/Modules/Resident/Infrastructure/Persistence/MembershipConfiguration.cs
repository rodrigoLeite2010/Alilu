using Alilu.Modules.Resident.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Resident.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="CondominiumMembership"/>. Descoberto
/// dinamicamente por <c>AliluDbContext.OnModelCreating</c>.
/// </summary>
public sealed class MembershipConfiguration : IEntityTypeConfiguration<CondominiumMembership>
{
    public void Configure(EntityTypeBuilder<CondominiumMembership> builder)
    {
        builder.ToTable("condominium_memberships", "resident");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.UserId).IsRequired();
        builder.Property(m => m.CondominiumId).IsRequired();
        builder.Property(m => m.UnitId).IsRequired();

        builder.HasIndex(m => m.UserId);
        builder.HasIndex(m => m.CondominiumId);

        // Enum armazenado como texto — mesma decisão de Status/Type nos
        // módulos Identity/Condominium.
        builder.Property(m => m.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(m => m.ValidatedAt);
        builder.Property(m => m.ValidatedBy);

        builder.Property(m => m.CreatedAt).IsRequired();
        builder.Property(m => m.UpdatedAt).IsRequired();

        // "Não permitir vínculo duplicado" (PROMPT 05) — segunda camada de
        // defesa (a primeira é a checagem em MembershipService antes de
        // persistir, ver DuplicateMembershipException): um mesmo usuário
        // não pode ter mais de um vínculo Pending/Active para a mesma
        // unidade ao mesmo tempo. Índice único FILTRADO (parcial) — de
        // propósito não cobre Rejected/Blocked, para permitir que o mesmo
        // usuário solicite de novo depois de uma rejeição, por exemplo.
        // As colunas precisam de aspas duplas porque este projeto não usa
        // nenhum plugin de convenção de nomes do EF Core — os nomes ficam
        // exatamente como estão em C# (PascalCase), mesma observação já
        // registrada no módulo Condominium (CodeHash/Status etc.).
        builder.HasIndex(m => new { m.UserId, m.CondominiumId, m.UnitId })
            .HasFilter("\"Status\" IN ('Pending','Active')")
            .IsUnique();

        // Nenhum evento de domínio é levantado nesta etapa.
        builder.Ignore(m => m.DomainEvents);
    }
}
