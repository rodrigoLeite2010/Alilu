import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  DEFAULT_SOCIAL_DESTINATIONS,
  SocialDestinationsPicker,
  buildDestinationsBody,
  type ConnectedFacebookPage,
  type DestinationProfilesState,
  type SocialDestinationsValue,
} from "@/components/instagram/SocialDestinationsPicker";

const NO_PROFILES: DestinationProfilesState = { loaded: true, primaryInstagramAccountId: "acc-alilu", profiles: [] };

function Harness({ pages, postType = "image", hasVideoItems = false, onValue, profiles = NO_PROFILES, suggestDefaults = false }: {
  pages: ConnectedFacebookPage[];
  postType?: "image" | "carousel" | "reels" | "story";
  hasVideoItems?: boolean;
  onValue?: (value: SocialDestinationsValue) => void;
  profiles?: DestinationProfilesState;
  suggestDefaults?: boolean;
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
      profiles={profiles}
      suggestDefaults={suggestDefaults}
    />
  );
}

const ALILU: ConnectedFacebookPage = { id: "p1", pageName: "Alilu", status: "connected", linkedIgUsername: "alilu.tec", instagramAccountId: "acc-alilu" };
const OTHER: ConnectedFacebookPage = { id: "p2", pageName: "Outra", status: "connected", linkedIgUsername: null };

describe("SocialDestinationsPicker", () => {
  it("por padrão só Instagram (comportamento atual)", () => {
    render(<Harness pages={[ALILU]} />);
    expect(screen.getByRole("checkbox", { name: /Instagram/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Facebook/ })).not.toBeChecked();
    expect(buildDestinationsBody(DEFAULT_SOCIAL_DESTINATIONS)).toEqual({ body: { instagram: true, facebookPageIds: [], facebookCaption: null } });
  });

  it("marcar Facebook com uma única Página NÃO a escolhe sozinho: exige marcar a Página", () => {
    const onValue = vi.fn();
    render(<Harness pages={[ALILU]} onValue={onValue} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /^Facebook/ }));
    let value = onValue.mock.calls.at(-1)![0] as SocialDestinationsValue;
    expect(value.facebookPageIds).toEqual([]);
    expect(buildDestinationsBody(value)).toEqual({ error: "Escolha a Página do Facebook onde publicar." });
    fireEvent.click(screen.getByRole("checkbox", { name: /Alilu/ }));
    value = onValue.mock.calls.at(-1)![0] as SocialDestinationsValue;
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
    fireEvent.click(screen.getByRole("checkbox", { name: /^Facebook/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Alilu/ }));
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

  it("mostra 'Esta publicação será enviada para:' com Facebook não selecionado", () => {
    render(<Harness pages={[ALILU]} />);
    expect(screen.getByText("Esta publicação será enviada para:")).toBeInTheDocument();
    expect(screen.getByText("Instagram: @alilu.tec")).toBeInTheDocument();
    expect(screen.getByText("Facebook: não selecionado")).toBeInTheDocument();
  });

  it("conta com Facebook desativado (Se Tá Bom Pra Você): checkbox bloqueado e explicação", () => {
    const profiles: DestinationProfilesState = {
      loaded: true,
      primaryInstagramAccountId: "acc-setabom",
      profiles: [{ instagramAccountId: "acc-setabom", facebookEnabled: false, allowedFacebookPageRefs: [], defaultFacebookPageRefs: [] }],
    };
    render(<Harness pages={[ALILU]} profiles={profiles} suggestDefaults />);
    expect(screen.getByRole("checkbox", { name: /^Facebook/ })).toBeDisabled();
    expect(screen.getByText(/desativado para esta conta/)).toBeInTheDocument();
    expect(screen.getByText("Facebook: não selecionado")).toBeInTheDocument();
  });

  it("Página vinculada a OUTRA conta do Instagram não é oferecida (GTA 6 não vê a Página Alilu)", () => {
    const profiles: DestinationProfilesState = { loaded: true, primaryInstagramAccountId: "acc-gta", profiles: [] };
    const gta: ConnectedFacebookPage = { id: "p9", pageName: "GTA 6", status: "connected", linkedIgUsername: "gta6", instagramAccountId: "acc-gta" };
    render(<Harness pages={[ALILU, gta]} profiles={profiles} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /^Facebook/ }));
    expect(screen.getByRole("checkbox", { name: /GTA 6/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Alilu/ })).toBeNull();
  });

  it("destinos padrão da conta entram como sugestão inicial editável (Alilu: Instagram + Página Alilu)", () => {
    const onValue = vi.fn();
    const profiles: DestinationProfilesState = {
      loaded: true,
      primaryInstagramAccountId: "acc-alilu",
      profiles: [{ instagramAccountId: "acc-alilu", facebookEnabled: true, allowedFacebookPageRefs: ["p1"], defaultFacebookPageRefs: ["p1"] }],
    };
    render(<Harness pages={[ALILU, OTHER]} profiles={profiles} onValue={onValue} suggestDefaults />);
    const value = onValue.mock.calls.at(-1)![0] as SocialDestinationsValue;
    expect(buildDestinationsBody(value)).toEqual({ body: { instagram: true, facebookPageIds: ["p1"], facebookCaption: null } });
    expect(screen.getByText("Facebook: Alilu")).toBeInTheDocument();
    // "Outra" não é permitida para a conta: nem aparece.
    expect(screen.queryByRole("checkbox", { name: /Outra/ })).toBeNull();
    // Editável: desmarcar o Facebook volta para só Instagram.
    fireEvent.click(screen.getByRole("checkbox", { name: /^Facebook/ }));
    expect(buildDestinationsBody(onValue.mock.calls.at(-1)![0] as SocialDestinationsValue)).toEqual({
      body: { instagram: true, facebookPageIds: [], facebookCaption: null },
    });
  });
});
