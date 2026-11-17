import { redirect } from "next/navigation";

/** Atalho: "Games" abre as Filas de vídeos já na categoria Games. */
export default function GamesPage() {
  redirect("/instagram/filas?categoria=games");
}
