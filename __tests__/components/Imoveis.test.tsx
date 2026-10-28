import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PropertyForm } from "@/components/imoveis/PropertyForm";
import { FilterPanel } from "@/components/imoveis/FilterPanel";
import { OwnerPanel } from "@/components/imoveis/OwnerPanel";
import {
  PropertyGallery,
  PropertyActions,
} from "@/components/imoveis/PropertyActions";
import {
  DEFAULT_SETTINGS,
  EMPTY_PROPERTY,
  type Property,
} from "@/lib/imoveis/model";
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const data = {
  ...EMPTY_PROPERTY,
  title: "Casa com quintal e muita luz natural",
  description:
    "Casa com quintal amplo em uma região tranquila, com bastante luz natural em todos os ambientes.",
  city: "São José dos Campos",
  neighborhood: "Centro",
  price: 500000,
  area: 150,
  advertiser: "Maria Silva",
};
const photos = [
  { id: "a", url: "/a.webp", thumbnail: "/a-thumb.webp" },
  { id: "b", url: "/b.webp", thumbnail: "/b-thumb.webp" },
];
const property: Property = {
  id: "id",
  slug: "casa-id",
  data,
  status: "published",
  images: photos,
  revision: 2,
  views: 10,
  contacts: 3,
  updated_at: "2026-10-28T00:00:00Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ ok: true })),
  );
});
describe("Portal Imóveis — interação", () => {
  it("preserva milhões e centavos no preço, condomínio, IPTU e taxas ao editar e salvar", async () => {
    render(
      <PropertyForm
        config={DEFAULT_SETTINGS}
        initial={{
          ...property,
          data: {
            ...data,
            price: 2659574.47,
            condo: 930.5,
            iptu: 3000.75,
            fees: 25.99,
          },
          phone: "11999999999",
          address: "",
          zip: "",
          consent: true,
        }}
      />,
    );
    for (let i = 0; i < 3; i++)
      fireEvent.submit(
        screen.getByRole("button", { name: /Continuar/ }).closest("form")!,
      );
    const price = screen.getByLabelText("Preço de venda (R$)");
    expect(price).toHaveAttribute("type", "text");
    expect(price).toHaveAttribute("inputmode", "decimal");
    expect(price).toHaveValue("2.659.574,47");
    expect(screen.getByLabelText("Condomínio mensal (R$)")).toHaveValue(
      "930,50",
    );
    expect(screen.getByLabelText("IPTU anual (R$)")).toHaveValue("3.000,75");
    expect(screen.getByLabelText("Outras taxas mensais (R$)")).toHaveValue(
      "25,99",
    );
    fireEvent.change(price, { target: { value: "2659574,47" } });
    fireEvent.blur(price);
    expect(price).toHaveValue("2.659.574,47");
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    expect(
      JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body)),
    ).toMatchObject({
      price: 2659574.47,
      condo: 930.5,
      iptu: 3000.75,
      fees: 25.99,
    });
  });
  it("não salva como R$ 2,66 uma entrada com separador ambíguo e oito casas decimais", async () => {
    render(
      <PropertyForm
        config={DEFAULT_SETTINGS}
        initial={{
          ...property,
          phone: "11999999999",
          address: "",
          zip: "",
          consent: true,
        }}
      />,
    );
    for (let i = 0; i < 3; i++)
      fireEvent.submit(
        screen.getByRole("button", { name: /Continuar/ }).closest("form")!,
      );
    fireEvent.change(screen.getByLabelText("Preço de venda (R$)"), {
      target: { value: "2,65957447" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "duas casas decimais",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("abre e recolhe os filtros no celular", () => {
    render(
      <FilterPanel>
        <p>Filtros de imóveis</p>
      </FilterPanel>,
    );
    const button = screen.getByRole("button", { name: "Filtrar imóveis" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(
      screen.getByRole("button", { name: "Ocultar filtros" }),
    ).toHaveAttribute("aria-expanded", "true");
  });
  it("percorre etapas, altera preço, reordena fotos, remove e salva anúncio real na API", async () => {
    render(
      <PropertyForm
        config={DEFAULT_SETTINGS}
        initial={{
          ...property,
          phone: "11999999999",
          address: "",
          zip: "",
          consent: true,
        }}
      />,
    );
    for (let i = 0; i < 3; i++)
      fireEvent.submit(
        screen.getByRole("button", { name: /Continuar/ }).closest("form")!,
      );
    fireEvent.change(screen.getByLabelText("Preço de venda (R$)"), {
      target: { value: "450000" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /Continuar/ }).closest("form")!,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tornar principal" }));
    const remove = screen.getAllByRole("button", { name: "Remover" });
    fireEvent.click(remove[1]);
    fireEvent.submit(
      screen
        .getByRole("button", { name: /Enviar para análise/ })
        .closest("form")!,
    );
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/imoveis/meus-anuncios"),
    );
    const call = vi
      .mocked(fetch)
      .mock.calls.find(([path]) => String(path) === "/api/imoveis/id");
    expect(call).toBeDefined();
    expect(JSON.parse(String(call![1]!.body))).toMatchObject({
      price: 450000,
      imageIds: ["b"],
      submit: true,
      revision: 2,
    });
  });
  it("salva rascunho incompleto, informa erro de servidor e não perde os campos", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json({ error: "Limite de anúncios atingido." }, { status: 409 }),
    );
    render(<PropertyForm config={DEFAULT_SETTINGS} />);
    fireEvent.change(screen.getByLabelText("Título do anúncio"), {
      target: { value: "Meu rascunho" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Limite");
    expect(screen.getByLabelText("Título do anúncio")).toHaveValue(
      "Meu rascunho",
    );
    expect(
      JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body)),
    ).toMatchObject({ submit: false, title: "Meu rascunho" });
  });
  it("envia múltiplas fotos e limita quantidade antes de fazer upload", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 800, height: 600, close: vi.fn() })),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => callback(new Blob(["image"], { type: "image/webp" })),
    );
    vi.mocked(fetch).mockImplementation(async () =>
      Response.json({
        id: crypto.randomUUID(),
        url: "/photo.webp",
        thumbnail: "/thumb.webp",
      }),
    );
    render(
      <PropertyForm
        config={{ ...DEFAULT_SETTINGS, maxPhotos: 3 }}
        initial={{
          ...property,
          data: { ...data, watermarkName: "Imobiliária Alameda" },
          images: [],
          phone: "11999999999",
          address: "",
          zip: "",
          consent: true,
        }}
      />,
    );
    for (let i = 0; i < 4; i++)
      fireEvent.submit(
        screen.getByRole("button", { name: /Continuar/ }).closest("form")!,
      );
    const files = [
      new File(["image"], "one.jpg", { type: "image/jpeg" }),
      new File(["image"], "two.jpg", { type: "image/jpeg" }),
    ];
    fireEvent.change(screen.getByLabelText("Selecionar fotos do imóvel"), {
      target: { files },
    });
    await waitFor(() =>
      expect(screen.getByText(/2 \/ 3 fotos/)).toBeInTheDocument(),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(
      "watermark=Imobili%C3%A1ria%20Alameda",
    );
    fireEvent.change(screen.getByLabelText("Selecionar fotos do imóvel"), {
      target: { files },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("no máximo 3");
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });
  it("marca capa e abre galeria ampliada", () => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    render(<PropertyGallery images={photos} title={data.title} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver foto 2" }));
    expect(screen.getByRole("button", { name: "Ver foto 2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ampliar foto do imóvel" }),
    );
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
  });
  it("salva favorito autenticado e copia link", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(async () => {}) },
    });
    render(
      <PropertyActions
        id="id"
        url="https://alilu.com.br/imoveis/casa-id"
        available={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Favoritar" }));
    await screen.findByRole("button", { name: "Salvo" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/imoveis/id/favorite",
      expect.objectContaining({ body: JSON.stringify({ saved: true }) }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));
    await screen.findByText("Link copiado!");
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://alilu.com.br/imoveis/casa-id",
    );
  });
  it("pausa e pede confirmação concreta antes de excluir", async () => {
    render(<OwnerPanel items={[property]} />);
    fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith(
      "/api/imoveis/id/status",
      expect.objectContaining({ body: JSON.stringify({ status: "paused" }) }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    const dialog = screen.getByRole("alert");
    expect(
      within(dialog).getByRole("button", { name: "Confirmar exclusão" }),
    ).toBeInTheDocument();
  });
});
