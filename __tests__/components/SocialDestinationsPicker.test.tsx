import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  DEFAULT_SOCIAL_DESTINATIONS,
  SocialDestinationsPicker,
  buildDestinationsBody,
  type ConnectedFacebookPage,
  type SocialDestinationsValue,
} from "@/components/instagram/SocialDestinationsPicker";

function Harness({ pages, postType = "image", hasVideoItems = false, onValue }: {
  pages: ConnectedFacebookPage[];
  postType?: "image" | "carousel" | "reels" | "story";
  hasVideoItems?: boolean;
  onValue?: (value: SocialDestinationsValue) => void;
}) {
  const [value, setValue] = useState(DEFAULT_SOCIAL_DESTINATIONS);
  return (
    <SocialDestinationsPicker
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
      postType={postType}
      hasVideoItems={hasVideoItems}
      instagramLabel="@alilu.tec"
      returnPath="/instagram/painel"
      pages={{ pages, loaded: true, configured: true }}
    />
  );
}

const ALILU: ConnectedFacebookPage = { id: "p1", pageName: "Alilu", status: "connected", linkedIgUsername: "alilu.tec" };
const OTHER: ConnectedFacebookPage = { id: "p2", pageName: "Outra", status: "connected", linkedIgUsername: null };

describe("SocialDestinationsPicker", () => {
  it("por padrão só Instagram (comportamento atual)", () => {
    render(<Harness pages={[ALILU]} />);
    expect(screen.getByRole("checkbox", { name: /Instagram/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Facebook/ })).not.toBeChecked();
    expect(buildDestinationsBody(DEFAULT_SOCIAL_DESTINATIONS)).toEqual({ body: { instagram: true, facebookPageIds: [], facebookCaption: null } });
  });

  it("marcar Facebook com uma única Página mostra a Página e monta o destino", () => {
    const onValue = vi.fn();
    render(<Harness pages={[ALILU]} onValue={onValue} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Facebook/ }));
    expect(screen.getByText(/: Alilu/)).toBeInTheDocument();
    const value = onValue.mock.calls.at(-1)![0] as SocialDestinationsValue;
    expect(buildDestinationsBody(value)).toEqual({ body: { instagram: true, facebookPageIds: ["p1"], facebookCaption: null } });
  });

  it("com várias Páginas nada é pré-selecionado: exige escolha explícita", () => {
    const onValue = vi.fn();
    render(<Harness pages={[ALILU, OTHER]} onValue={onValue} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /^Facebook/ }));
    const value = onValue.mock.calls.at(-1)![0] as SocialDestinationsValue;
    expect(value.facebookPageIds).toEqual([]);
    expect(buildDestinationsBody(value)).toEqual({ error: "Escolha a Página do Facebook onde publicar." });
    fireEvent.click(screen.getByRole("checkbox", { name: /Outra/ }));
    expect((onValue.mock.calls.at(-1)![0] as SocialDestinationsValue).facebookPageIds).toEqual(["p2"]);
  });

  it("não permite salvar sem nenhuma rede", () => {
    expect(buildDestinationsBody({ ...DEFAULT_SOCIAL_DESTINATIONS, instagram: false })).toHaveProperty("error");
  });

  it("legenda personalizada do Facebook", () => {
    const onValue = vi.fn();
    render(<Harness pages={[ALILU]} onValue={onValue} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Facebook/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Personalizar/ }));
    fireEvent.change(screen.getByLabelText("Legenda do Facebook"), { target: { value: "Texto do Face" } });
    const value = onValue.mock.calls.at(-1)![0] as SocialDestinationsValue;
    expect(buildDestinationsBody(value)).toEqual({ body: { instagram: true, facebookPageIds: ["p1"], facebookCaption: "Texto do Face" } });
  });

  it("sem Página conectada oferece conectar", () => {
    render(<Harness pages={[]} />);
    expect(screen.getByRole("link", { name: /Conectar Página do Facebook/ })).toHaveAttribute(
      "href",
      "/api/facebook/pages/oauth/start?returnTo=%2Finstagram%2Fpainel",
    );
    expect(screen.getByRole("checkbox", { name: /Facebook/ })).toBeDisabled();
  });

  it("Story e carrossel com vídeo explicam por que o Facebook não está disponível", () => {
    render(<Harness pages={[ALILU]} postType="carousel" hasVideoItems />);
    expect(screen.getByText(/carrossel com vídeo/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Facebook/ })).toBeDisabled();
  });
});
