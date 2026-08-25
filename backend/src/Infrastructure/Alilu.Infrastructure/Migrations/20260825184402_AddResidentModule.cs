using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alilu.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddResidentModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "resident");

            migrationBuilder.CreateTable(
                name: "condominium_memberships",
                schema: "resident",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ValidatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ValidatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_condominium_memberships", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_condominium_memberships_CondominiumId",
                schema: "resident",
                table: "condominium_memberships",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_condominium_memberships_UserId",
                schema: "resident",
                table: "condominium_memberships",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_condominium_memberships_UserId_CondominiumId_UnitId",
                schema: "resident",
                table: "condominium_memberships",
                columns: new[] { "UserId", "CondominiumId", "UnitId" },
                unique: true,
                filter: "\"Status\" IN ('Pending','Active')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "condominium_memberships",
                schema: "resident");
        }
    }
}
