import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  AutomationFacebookPanel,
  choiceFromValue,
  valueFromChoice,
} from "@/components/instagram/content-automation/AutomationFacebookPanel";

const pages = [
  { id: "p1", pageName: "Alilu", status: "connected" as const, instagramAccountId: "acc-1", linkedIgUsername: "alilu.tec" },
  { id: "p2", pageName: "Outra", status: "connected" as const, instagramAccountId: null, linkedIgUsername: null },
];

afterEach(() => vi.restoreAllMocks());

describe("AutomationFacebookPanel", () => {
  it("converte o valor salvo em opção e de volta", () => {
    expect(choiceFromValue(null)).toBe("AUTO");
    expect(choiceFromValue(undefined)).toBe("AUTO");
    expect(choiceFromValue([])).toBe("OFF");
    expect(choiceFromValue(["p1"])).toBe("PAGES");
    expect(valueFromChoice("AUTO", ["p1"])).toBeNull();
    expect(valueFromChoice("OFF", ["p1"])).toEqual([]);
    expect(valueFromChoice("PAGES", ["p1"])).toEqual(["p1"]);
  });

  it("modo automático mostra a Página vinculada à conta da automação", () => {
    render(<AutomationFacebookPanel automationId="a1" instagramAccountId="acc-1" initialValue={null} returnPath="/x" pages={pages} />);
    expect(screen.getByText(/Publica também em: Alilu\./)).toBeTruthy();
  });

  it("sem Página conectada oferece conectar", () => {
    render(<AutomationFacebookPanel automationId="a1" instagramAccountId="acc-1" initialValue={null} returnPath="/x" pages={[]} />);
    expect(screen.getByText("Conectar Página do Facebook")).toBeTruthy();
  });

  it("salva as Páginas escolhidas pela ação update-facebook", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AutomationFacebookPanel automationId="a1" instagramAccountId="acc-1" initialValue={null} returnPath="/x" pages={pages} />);
    fireEvent.click(screen.getByLabelText("Escolher as Páginas"));
    fireEvent.click(screen.getByLabelText(/Outra/));
    fireEvent.click(screen.getByText("Salvar destino do Facebook"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/content-automation/automations/a1");
    expect(JSON.parse(init.body)).toEqual({ action: "update-facebook", facebookPageIds: ["p2"] });
    vi.unstubAllGlobals();
  });
});
