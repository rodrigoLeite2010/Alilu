import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PartnerSource } from "@/components/imoveis/integracoes/PartnerSource";
import { MappingEditor } from "@/components/imoveis/integracoes/ImportFlow";
import { TEMPLATE_COLUMNS } from "@/lib/imoveis/integracoes/fields";
import { chunkRecords } from "@/components/imoveis/integracoes/api";

describe("Integração de imóveis — interface", () => {
  it("mostra a origem do parceiro, o link de saída rastreado e o aviso de responsabilidade", () => {
    render(
      <PartnerSource
        propertyId="0b8c1f3e-2a4b-4c5d-8e9f-0a1b2c3d4e5f"
        available
        partner={{ original_url: "https://parceiro.example/a", last_synced_at: "", name: "Imob", trade_name: "Imob Fantasia", logo_url: "", partner_type: "Imobiliária" }}
      />,
    );
    const link = screen.getByRole("link", { name: /ver anúncio original/i });
    expect(link.getAttribute("href")).toBe("/imoveis/saida/0b8c1f3e-2a4b-4c5d-8e9f-0a1b2c3d4e5f");
    expect(link.getAttribute("rel")).toContain("nofollow");
    expect(screen.getByText(/não participa da corretagem/)).toBeTruthy();
  });
  it("não mostra link quando o anúncio está indisponível", () => {
    render(<PartnerSource propertyId="x" available={false} partner={{ original_url: "https://p.example", last_synced_at: "", name: "Imob", trade_name: "", logo_url: "", partner_type: "Corretor" }} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("mapeia automaticamente as colunas da planilha-modelo e salva", () => {
    const onSave = vi.fn();
    render(<MappingEditor fields={[...TEMPLATE_COLUMNS]} initial={{ mapping: {}, defaults: {}, transforms: {} }} onSave={onSave} />);
    const save = screen.getByRole("button", { name: /salvar mapeamento/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /mapear automaticamente/i }));
    expect((screen.getByLabelText("Origem de Código externo") as HTMLSelectElement).value).toBe("CodigoImovel");
    fireEvent.change(screen.getByLabelText("Padrão de Finalidade"), { target: { value: "Venda" } });
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ mapping: expect.objectContaining({ price: "Valor" }), defaults: { purpose: "Venda" } }));
  });
  it("divide registros em partes que respeitam o limite de corpo da Vercel", () => {
    const records = Array.from({ length: 1200 }, (_, i) => ({ i, text: "x".repeat(5000) }));
    const chunks = chunkRecords(records);
    expect(chunks.flat()).toHaveLength(1200);
    expect(Math.max(...chunks.map((c) => JSON.stringify(c).length))).toBeLessThan(3_100_000);
    expect(Math.max(...chunks.map((c) => c.length))).toBeLessThanOrEqual(500);
  });
});
