import "server-only";
import { attachAutomaticFacebookDestinations } from "@/lib/facebook/backend/social-destinations-service";
import { logPublicationEvent } from "@/lib/instagram/backend/publication-log";
import type { AutomationRecord } from "./automation-types";

/**
 * Piloto Automático → Facebook.
 *
 * As publicações do Piloto são criadas em instagram_posts e publicadas pelo
 * agendador único (/api/cron/instagram-publish). O Facebook só é publicado
 * por esse agendador quando a publicação TEM um destino Facebook em
 * social_publication_destinations — exatamente como acontece quando a
 * pessoa marca "Facebook" ao criar uma publicação manual. Esta função grava
 * esses destinos para as publicações do Piloto, conforme a configuração da
 * automação (`facebookPageIds`). Nada é publicado aqui.
 *
 * NUNCA lança: uma falha ao preparar o Facebook não pode impedir a
 * publicação no Instagram, que já foi criada.
 */
export async function attachAutomationFacebookDestinations(
  automation: Pick<AutomationRecord, "id" | "userId" | "instagramAccountId" | "facebookPageIds">,
  publicationId: string,
): Promise<number> {
  try {
    const result = await attachAutomaticFacebookDestinations({
      postId: publicationId,
      userId: automation.userId,
      instagramAccountId: automation.instagramAccountId,
      facebookPageIds: automation.facebookPageIds ?? null,
    });
    return result.created;
  } catch (error) {
    logPublicationEvent({ event: "facebook.automation.attach_failed", platform: "facebook", publicationId, status: "ERROR" });
    console.error("[content-automation] não foi possível preparar o destino Facebook", {
      automationId: automation.id,
      publicationId,
      message: error instanceof Error ? error.message : "erro desconhecido",
    });
    return 0;
  }
}
