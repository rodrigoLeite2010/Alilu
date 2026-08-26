using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Alilu.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProfessionalModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "scheduling");

            migrationBuilder.EnsureSchema(
                name: "administration");

            migrationBuilder.EnsureSchema(
                name: "notifications");

            migrationBuilder.EnsureSchema(
                name: "professional");

            migrationBuilder.EnsureSchema(
                name: "recommendations");

            migrationBuilder.EnsureSchema(
                name: "reviews");

            migrationBuilder.CreateTable(
                name: "booking_items",
                schema: "scheduling",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BookingId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceCategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Quantity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_booking_items", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bookings",
                schema: "scheduling",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ResidentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfessionalId = table.Column<Guid>(type: "uuid", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    ScheduledDate = table.Column<DateOnly>(type: "date", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bookings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "condominium_administrators",
                schema: "administration",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_condominium_administrators", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "device_tokens",
                schema: "notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_device_tokens", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "notifications",
                schema: "notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ReferenceId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReadAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notifications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "professional_availabilities",
                schema: "professional",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfessionalId = table.Column<Guid>(type: "uuid", nullable: false),
                    DayOfWeek = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    Active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_professional_availabilities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "professional_availability_exceptions",
                schema: "professional",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfessionalId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    EndTime = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_professional_availability_exceptions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "professional_condominiums",
                schema: "professional",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfessionalId = table.Column<Guid>(type: "uuid", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_professional_condominiums", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "professional_services",
                schema: "professional",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfessionalId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceCategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_professional_services", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "professionals",
                schema: "professional",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    PhotoUrl = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_professionals", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "recommendations",
                schema: "recommendations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: false),
                    RecommendedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfessionalId = table.Column<Guid>(type: "uuid", nullable: true),
                    ExternalProfessionalName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ExternalPhone = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    ServiceCategoryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_recommendations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "reviews",
                schema: "reviews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BookingId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResidentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProfessionalId = table.Column<Guid>(type: "uuid", nullable: false),
                    Rating = table.Column<int>(type: "integer", nullable: false),
                    Comment = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_reviews", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "service_categories",
                schema: "professional",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_service_categories", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_booking_items_BookingId",
                schema: "scheduling",
                table: "booking_items",
                column: "BookingId");

            migrationBuilder.CreateIndex(
                name: "IX_bookings_ProfessionalId_ScheduledDate",
                schema: "scheduling",
                table: "bookings",
                columns: new[] { "ProfessionalId", "ScheduledDate" });

            migrationBuilder.CreateIndex(
                name: "IX_bookings_ResidentId",
                schema: "scheduling",
                table: "bookings",
                column: "ResidentId");

            migrationBuilder.CreateIndex(
                name: "IX_condominium_administrators_UserId",
                schema: "administration",
                table: "condominium_administrators",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_device_tokens_UserId",
                schema: "notifications",
                table: "device_tokens",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_notifications_UserId",
                schema: "notifications",
                table: "notifications",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_notifications_UserId_ReadAt",
                schema: "notifications",
                table: "notifications",
                columns: new[] { "UserId", "ReadAt" });

            migrationBuilder.CreateIndex(
                name: "IX_notifications_UserId_Type_ReferenceId",
                schema: "notifications",
                table: "notifications",
                columns: new[] { "UserId", "Type", "ReferenceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_professional_availabilities_ProfessionalId_DayOfWeek",
                schema: "professional",
                table: "professional_availabilities",
                columns: new[] { "ProfessionalId", "DayOfWeek" });

            migrationBuilder.CreateIndex(
                name: "IX_professional_availability_exceptions_ProfessionalId_Date",
                schema: "professional",
                table: "professional_availability_exceptions",
                columns: new[] { "ProfessionalId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_professional_condominiums_CondominiumId",
                schema: "professional",
                table: "professional_condominiums",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_professional_condominiums_ProfessionalId",
                schema: "professional",
                table: "professional_condominiums",
                column: "ProfessionalId");

            migrationBuilder.CreateIndex(
                name: "IX_professional_condominiums_ProfessionalId_CondominiumId",
                schema: "professional",
                table: "professional_condominiums",
                columns: new[] { "ProfessionalId", "CondominiumId" },
                unique: true,
                filter: "\"Status\" IN ('Pending','Active')");

            migrationBuilder.CreateIndex(
                name: "IX_professional_services_ProfessionalId",
                schema: "professional",
                table: "professional_services",
                column: "ProfessionalId");

            migrationBuilder.CreateIndex(
                name: "IX_professional_services_ProfessionalId_ServiceCategoryId",
                schema: "professional",
                table: "professional_services",
                columns: new[] { "ProfessionalId", "ServiceCategoryId" },
                unique: true,
                filter: "\"Active\" = TRUE");

            migrationBuilder.CreateIndex(
                name: "IX_professional_services_ServiceCategoryId",
                schema: "professional",
                table: "professional_services",
                column: "ServiceCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_professionals_UserId",
                schema: "professional",
                table: "professionals",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_recommendations_ProfessionalId_Status",
                schema: "recommendations",
                table: "recommendations",
                columns: new[] { "ProfessionalId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_recommendations_RecommendedByUserId",
                schema: "recommendations",
                table: "recommendations",
                column: "RecommendedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_recommendations_Status",
                schema: "recommendations",
                table: "recommendations",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_reviews_BookingId",
                schema: "reviews",
                table: "reviews",
                column: "BookingId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_reviews_ProfessionalId",
                schema: "reviews",
                table: "reviews",
                column: "ProfessionalId");

            migrationBuilder.CreateIndex(
                name: "IX_reviews_ResidentId",
                schema: "reviews",
                table: "reviews",
                column: "ResidentId");

            migrationBuilder.CreateIndex(
                name: "IX_service_categories_Name",
                schema: "professional",
                table: "service_categories",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "booking_items",
                schema: "scheduling");

            migrationBuilder.DropTable(
                name: "bookings",
                schema: "scheduling");

            migrationBuilder.DropTable(
                name: "condominium_administrators",
                schema: "administration");

            migrationBuilder.DropTable(
                name: "device_tokens",
                schema: "notifications");

            migrationBuilder.DropTable(
                name: "notifications",
                schema: "notifications");

            migrationBuilder.DropTable(
                name: "professional_availabilities",
                schema: "professional");

            migrationBuilder.DropTable(
                name: "professional_availability_exceptions",
                schema: "professional");

            migrationBuilder.DropTable(
                name: "professional_condominiums",
                schema: "professional");

            migrationBuilder.DropTable(
                name: "professional_services",
                schema: "professional");

            migrationBuilder.DropTable(
                name: "professionals",
                schema: "professional");

            migrationBuilder.DropTable(
                name: "recommendations",
                schema: "recommendations");

            migrationBuilder.DropTable(
                name: "reviews",
                schema: "reviews");

            migrationBuilder.DropTable(
                name: "service_categories",
                schema: "professional");
        }
    }
}
