import "server-only";
import { getDb } from "@/lib/db/client";

/** O que os últimos carrosséis desta automação já usaram (para a anti-repetição). */
export interface CarouselHistory {
  topics: string[];
  hooks: string[];
  headlines: string[];
  photoIds: Set<string>;
  ownMediaIds: Set<string>;
  templateIds: string[];
  combinations: Set<string>;
  count: number;
}

export const DEFAULT_ANTI_REPEAT_WINDOW = 15;

/** Últimos `window` carrosséis da automação (do mais novo ao mais antigo), exceto o projeto atual. */
export async function loadCarouselHistory(automationId: string, window: number, excludeProjectId?: string | null): Promise<CarouselHistory> {
  const limit = Math.min(Math.max(Math.floor(window), 1), 60);
  const db = getDb();
  const projects = await db`
    select id, topic, title, template_id from carousel_projects
    where automation_id = ${automationId} and (${excludeProjectId ?? null}::uuid is null or id <> ${excludeProjectId ?? null}::uuid)
    order by created_at desc limit ${limit}
  `;
  const history: CarouselHistory = { topics: [], hooks: [], headlines: [], photoIds: new Set(), ownMediaIds: new Set(), templateIds: [], combinations: new Set(), count: projects.length };
  for (const project of projects) {
    history.topics.push(project.topic as string);
    if (project.template_id) history.templateIds.push(project.template_id as string);
    const slides = await db`select position, headline, image_media_id, style from carousel_slides where project_id = ${project.id} order by position`;
    const photos: string[] = [];
    for (const slide of slides) {
      if (Number(slide.position) === 1 && slide.headline) history.hooks.push(slide.headline as string);
      if (slide.headline) history.headlines.push(slide.headline as string);
      if (slide.image_media_id) history.ownMediaIds.add(slide.image_media_id as string);
      const style = (typeof slide.style === "string" ? JSON.parse(slide.style) : slide.style) as { photo?: { id?: string } } | null;
      const id = style?.photo?.id;
      if (id) {
        history.photoIds.add(id);
        photos.push(id);
      }
    }
    if (photos.length > 0) history.combinations.add([...photos].sort().join("|"));
  }
  return history;
}
