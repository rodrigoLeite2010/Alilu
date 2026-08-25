using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alilu.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCondominiumModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "condominium");

            migrationBuilder.CreateTable(
                name: "condominium_invitations",
                schema: "condominium",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    CodeHash = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_condominium_invitations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "condominium_units",
                schema: "condominium",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_condominium_units", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "condominiums",
                schema: "condominium",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    cnpj = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: false),
                    Address = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Number = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Neighborhood = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    City = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    State = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false),
                    ZipCode = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_condominiums", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_condominium_invitations_CodeHash",
                schema: "condominium",
                table: "condominium_invitations",
                column: "CodeHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_condominium_invitations_CondominiumId",
                schema: "condominium",
                table: "condominium_invitations",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_condominium_invitations_UnitId",
                schema: "condominium",
                table: "condominium_invitations",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_condominium_units_CondominiumId_Code",
                schema: "condominium",
                table: "condominium_units",
                columns: new[] { "CondominiumId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_condominiums_cnpj",
                schema: "condominium",
                table: "condominiums",
                column: "cnpj",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "condominium_invitations",
                schema: "condominium");

            migrationBuilder.DropTable(
                name: "condominium_units",
                schema: "condominium");

            migrationBuilder.DropTable(
                name: "condominiums",
                schema: "condominium");
        }
    }
}
