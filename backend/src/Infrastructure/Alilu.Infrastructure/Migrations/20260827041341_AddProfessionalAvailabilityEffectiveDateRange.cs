using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alilu.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProfessionalAvailabilityEffectiveDateRange : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "EffectiveFrom",
                schema: "professional",
                table: "professional_availabilities",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "EffectiveUntil",
                schema: "professional",
                table: "professional_availabilities",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EffectiveFrom",
                schema: "professional",
                table: "professional_availabilities");

            migrationBuilder.DropColumn(
                name: "EffectiveUntil",
                schema: "professional",
                table: "professional_availabilities");
        }
    }
}
