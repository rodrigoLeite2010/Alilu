import { BulkNotFoundError } from "@/lib/bulk-delete/core";
import { createBulkDeleteHandler } from "@/lib/bulk-delete/server";
import { deleteCarousel } from "@/lib/carousel/backend/carousel-publish-service";
import { CarouselError } from "@/lib/carousel/backend/carousel-project-service";

export const dynamic = "force-dynamic";

/** POST { ids } — exclui carrosséis do Alilu (mesma regra da individual: publicado/em publicação é mantido). */
export const POST = createBulkDeleteHandler({
  module: "carousel-projects",
  isUserError: (error) => error instanceof CarouselError,
  async deleteOne(id, userId) {
    try {
      await deleteCarousel(userId, id);
    } catch (error) {
      if (error instanceof CarouselError && error.code === "NOT_FOUND") throw new BulkNotFoundError();
      throw error;
    }
  },
});
