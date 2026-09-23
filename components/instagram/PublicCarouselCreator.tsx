"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  CarouselEditorTool,
  type CarouselPublishPanelSlotProps,
} from "@/components/tools/instagram-carousel-creator/CarouselEditorTool";
import {
  createSlideId,
  type CarouselEditorState,
  type CarouselFormatId,
} from "@/lib/instagram/carousel/carousel-state";
import { deserializeEditorState, serializeEditorState, type SerializedEditorState } from "@/lib/instagram/editor-state";
import { loadLocalValue, saveLocalValue } from "@/lib/instagram/draft-store";
import { fetchAccountStatus, type AccountStatus } from "@/lib/instagram/client/publication-api";
import { CarouselPublishPanel } from "./CarouselPublishPanel";
import { ConnectInstagramDialog, buildConnectTarget } from "./ConnectInstagramDialog";

const RETURN_PATH = "/instagram/carrossel?continuar=1";

interface StoredCarouselDraft {
  formatId: CarouselFormatId;
  selectedIndex: number;
  slides: Array<{ editor: SerializedEditorState; image: Blob | null }>;
}

async function serializeCarousel(state: CarouselEditorState): Promise<StoredCarouselDraft> {
  const slides: StoredCarouselDraft["slides"] = [];
  for (const slide of state.slides) {
    let image: Blob | null = null;
    if (slide.state.backgroundImage.url) {
      try {
        image = await (await fetch(slide.state.backgroundImage.url)).blob();
      } catch {
        image = null;
      }
    }
    slides.push({ editor: serializeEditorState(slide.state), image });
  }
  return {
    formatId: state.formatId,
    selectedIndex: Math.max(0, state.slides.findIndex((slide) => slide.id === state.selectedSlideId)),
    slides,
  };
}

function restoreCarousel(draft: StoredCarouselDraft): CarouselEditorState | null {
  const slides = draft.slides
    .map((stored, order) => {
      const url = stored.image ? URL.createObjectURL(stored.image) : null;
      const state = deserializeEditorState(stored.editor, url);
      return state ? { id: createSlideId(), order, state } : null;
    })
    .filter((slide): slide is NonNullable<typeof slide> => slide !== null);
  if (slides.length === 0) return null;
  const selected = slides[Math.min(draft.selectedIndex, slides.length - 1)];
  return { formatId: draft.formatId, slides, selectedSlideId: selected.id };
}

/**
 * Criador de Carrosséis público (/instagram/carrossel): criar, editar e
 * baixar em ZIP continuam sem login. "Publicar no Instagram" / "Agendar
 * publicação" ficam visíveis para todos; sem conta conectada, abrem a
 * etapa de conexão — antes de sair, os slides (com as fotos) vão para um
 * rascunho local e voltam quando a pessoa retorna com `?continuar=1`.
 * Com a conta conectada, usa o mesmo CarouselPublishPanel da área logada.
 */
export function PublicCarouselCreator() {
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [session, setSession] = useState<{ key: number; state?: CarouselEditorState }>({ key: 0 });
  const [notice, setNotice] = useState<string | null>(null);
  const latestRef = useRef<CarouselEditorState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAccountStatus()
      .then((status) => !cancelled && setAccount(status))
      .catch(() => !cancelled && setAccount({ authenticated: false, connected: false, username: null }));

    const params = new URLSearchParams(window.location.search);
    if (params.get("continuar") === "1") {
      loadLocalValue<StoredCarouselDraft>("carousel").then((draft) => {
        if (cancelled || !draft) return;
        const restored = restoreCarousel(draft);
        if (!restored) return;
        setSession({ key: 1, state: restored });
        setNotice(
          params.get("status") === "conectado"
            ? "Instagram conectado! Seu carrossel foi restaurado — agora é só publicar ou agendar."
            : "Seu carrossel foi restaurado. Continue de onde parou.",
        );
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStateChange = useCallback((state: CarouselEditorState) => {
    latestRef.current = state;
  }, []);

  const PanelSlot = useMemo(() => {
    if (account?.connected && account.userId) {
      const userId = account.userId;
      function ConnectedPanel({ slides, formatId }: CarouselPublishPanelSlotProps) {
        return <CarouselPublishPanel slides={slides} formatId={formatId} userId={userId} />;
      }
      return ConnectedPanel;
    }
    const status = account;
    function GatePanel() {
      const [open, setOpen] = useState(false);
      async function connect() {
        if (latestRef.current) {
          await saveLocalValue("carousel", await serializeCarousel(latestRef.current));
        }
        window.location.href = buildConnectTarget(Boolean(status?.authenticated), RETURN_PATH);
      }
      return (
        <div className="space-y-3 rounded-lg border border-teal-200 bg-teal-50/60 p-4">
          <div>
            <p className="text-sm font-semibold text-teal-900">Publicar no Instagram</p>
            <p className="mt-1 text-xs text-teal-800">
              Publique este carrossel (2 a 10 slides) agora ou agende. Você só conecta sua conta na hora de publicar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setOpen(true)} disabled={!status} className="flex-1 justify-center">
              Publicar no Instagram
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(true)} disabled={!status} className="flex-1 justify-center">
              Agendar publicação
            </Button>
          </div>
          <ConnectInstagramDialog
            open={open}
            authenticated={Boolean(status?.authenticated)}
            needsReconnect={Boolean(status?.needsReconnect)}
            onClose={() => setOpen(false)}
            onConnect={() => void connect()}
          />
        </div>
      );
    }
    return GatePanel;
  }, [account]);

  return (
    <div className="space-y-4">
      {notice ? (
        <p role="status" className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {notice}
        </p>
      ) : null}
      <CarouselEditorTool key={session.key} initialState={session.state} onStateChange={handleStateChange} publishPanel={PanelSlot} />
    </div>
  );
}
