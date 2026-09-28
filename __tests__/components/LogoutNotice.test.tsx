import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { LogoutNotice } from "@/components/layout/LogoutNotice";

const routerReplace = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace }),
  useSearchParams: () => searchParamsValue,
}));

/**
 * Aviso "Você saiu da sua conta." mostrado após o logout (?saiu=1 na URL
 * — ver UserMenu/MobileAccountSection). Cobre: não aparece sem o
 * parâmetro, aparece e limpa a URL quando ele está presente, some
 * sozinho depois de alguns segundos e pode ser fechado na hora.
 */
describe("LogoutNotice", () => {
  beforeEach(() => {
    routerReplace.mockReset();
    searchParamsValue = new URLSearchParams();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("não mostra nada quando não há ?saiu=1", () => {
    render(<LogoutNotice />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it("mostra o aviso e limpa o parâmetro da URL quando ?saiu=1 está presente", () => {
    searchParamsValue = new URLSearchParams("saiu=1");
    render(<LogoutNotice />);

    expect(screen.getByRole("status")).toHaveTextContent("Você saiu da sua conta.");
    expect(routerReplace).toHaveBeenCalledWith("/", { scroll: false });
  });

  it("some sozinho depois de alguns segundos", () => {
    vi.useFakeTimers();
    searchParamsValue = new URLSearchParams("saiu=1");
    render(<LogoutNotice />);

    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it('fecha na hora ao clicar em "Fechar aviso"', () => {
    searchParamsValue = new URLSearchParams("saiu=1");
    render(<LogoutNotice />);

    fireEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
