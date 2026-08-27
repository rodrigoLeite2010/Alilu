using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alilu.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Etapa23 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "mural");

            migrationBuilder.AlterColumn<Guid>(
                name: "BookingId",
                schema: "reviews",
                table: "reviews",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.CreateTable(
                name: "mural_posts",
                schema: "mural",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    AuthorUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Content = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    BlockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    BlockedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mural_posts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "professional_invitations",
                schema: "professional",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    InvitedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Email = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    WhatsAppDelivered = table.Column<bool>(type: "boolean", nullable: false),
                    SmsDelivered = table.Column<bool>(type: "boolean", nullable: false),
                    EmailDelivered = table.Column<bool>(type: "boolean", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_professional_invitations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_reviews_ResidentId_ProfessionalId",
                schema: "reviews",
                table: "reviews",
                columns: new[] { "ResidentId", "ProfessionalId" },
                unique: true,
                filter: "\"BookingId\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_mural_posts_CondominiumId_AuthorUserId",
                schema: "mural",
                table: "mural_posts",
                columns: new[] { "CondominiumId", "AuthorUserId" });

            migrationBuilder.CreateIndex(
                name: "IX_mural_posts_CondominiumId_Status",
                schema: "mural",
                table: "mural_posts",
                columns: new[] { "CondominiumId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_professional_invitations_InvitedByUserId_CreatedAt",
                schema: "professional",
                table: "professional_invitations",
                columns: new[] { "InvitedByUserId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "mural_posts",
                schema: "mural");

            migrationBuilder.DropTable(
                name: "professional_invitations",
                schema: "professional");

            migrationBuilder.DropIndex(
                name: "IX_reviews_ResidentId_ProfessionalId",
                schema: "reviews",
                table: "reviews");

            migrationBuilder.AlterColumn<Guid>(
                name: "BookingId",
                schema: "reviews",
                table: "reviews",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
