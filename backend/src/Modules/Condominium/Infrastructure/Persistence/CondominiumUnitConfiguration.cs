using Alilu.Modules.Condominium.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Alilu.Modules.Condominium.Infrastructure.Persistence;

/// <summary>
/// Mapeamento EF Core de <see cref="CondominiumUnit"/>. Descoberto
/// dinamicamente por <c>AliluDbContext.OnModelCreating</c>.
/// </summary>
public sealed class CondominiumUnitConfiguration : IEntityTypeConfiguration<CondominiumUnit>
{
    public void Configure(EntityTypeBuilder<CondominiumUnit> builder)
    {
        builder.ToTable("condominium_units", "condominium");

        builder.HasKey(u => u.Id);

        builder.Property(u => u.CondominiumId).IsRequired();

        builder.Property(u => u.Code)
            .HasMaxLength(20)
            .IsRequired();

        // "O código da unidade deve ser único dentro do condomínio"
        // (PROMPT 04) — índice único composto, segunda linha de defesa
        // depois da checagem em CondominiumService.CreateUnitAsync. Não há
        // FK/navegação para Condominium — ver comentário em
        // Domain/CondominiumUnit.cs.
        builder.HasIndex(u => new { u.CondominiumId, u.Code })
            .IsUnique();

        builder.Property(u => u.Type)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(u => u.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(u => u.CreatedAt).IsRequired();

        builder.Ignore(u => u.DomainEvents);
    }
}
