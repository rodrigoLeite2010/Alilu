using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alilu.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProfessionalCategories : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CategoryId",
                schema: "professional",
                table: "service_categories",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "professional_categories",
                schema: "professional",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    Active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_professional_categories", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_professional_categories_Name",
                schema: "professional",
                table: "professional_categories",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "professional_categories",
                schema: "professional");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                schema: "professional",
                table: "service_categories");
        }
    }
}
