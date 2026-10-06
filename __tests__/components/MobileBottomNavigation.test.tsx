import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MobileBottomNavigation } from "@/components/mobile/MobileBottomNavigation";

let mockPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

describe("MobileBottomNavigation", () => {
  it("mostra os cinco itens principais na ordem: Início, Criar, Instagram, Agenda, Perfil", () => {
    mockPathname = "/";
    render(<MobileBottomNavigation />);

    const nav = screen.getByRole("navigation", { name: /navegação inferior/i });
    const entries = within(nav).getAllByRole("listitem");
    expect(entries.map((entry) => entry.textContent)).toEqual(["Início", "Criar", "Instagram", "Agenda", "Perfil"]);

    expect(within(nav).getByRole("link", { name: "Início" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "/instagram");
    expect(within(nav).getByRole("link", { name: "Agenda" })).toHaveAttribute("href", "/agenda");
    expect(within(nav).getByRole("link", { name: "Perfil" })).toHaveAttribute("href", "/minha-conta");
  });

  it("é oculta a partir de 768px e na impressão, e respeita a safe area", () => {
    render(<MobileBottomNavigation />);
    const nav = screen.getByRole("navigation", { name: /navegação inferior/i });
    expect(nav).toHaveClass("md:hidden", "print:hidden");
    expect(nav.className).toContain("env(safe-area-inset-bottom)");
  });

  it("marca como atual o item da rota aberta (inclusive subrotas)", () => {
    mockPathname = "/instagram/reels";
    render(<MobileBottomNavigation />);

    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Início" })).not.toHaveAttribute("aria-current");
  });

  it("Início só fica ativo na raiz", () => {
    mockPathname = "/";
    render(<MobileBottomNavigation />);
    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute("aria-current", "page");
  });

  it('"Criar" abre um bottom sheet com as ferramentas de vídeo e de Instagram e fecha com Esc', () => {
    mockPathname = "/";
    render(<MobileBottomNavigation />);

    fireEvent.click(screen.getByRole("button", { name: /criar/i }));

    const dialog = screen.getByRole("dialog", { name: /o que você quer criar/i });
    expect(within(dialog).getByRole("link", { name: /^Post/ })).toHaveAttribute("href", "/instagram/criar-post");
    expect(within(dialog).getByRole("link", { name: /^Reel/ })).toHaveAttribute("href", "/instagram/reels");
    expect(within(dialog).getByRole("link", { name: /^Carrossel/ })).toHaveAttribute("href", "/instagram/carrossel");
    expect(within(dialog).getByRole("link", { name: /^Split Screen/ })).toHaveAttribute("href", "/videos/editor-split-screen");
    expect(within(dialog).getByRole("link", { name: /^Vídeo com IA/ })).toHaveAttribute("href", "/videos/imagem-para-video");
    expect(within(dialog).getByRole("link", { name: /^Importar do Instagram/ })).toHaveAttribute("href", "/videos/importar-instagram");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("escolher uma opção fecha o sheet", () => {
    render(<MobileBottomNavigation />);
    fireEvent.click(screen.getByRole("button", { name: /criar/i }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("link", { name: /^Post/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
