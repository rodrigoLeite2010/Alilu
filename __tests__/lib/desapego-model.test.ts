import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRODUCT_CATEGORIES,
  DesapegoError,
  parseProduct,
  parseProductFilters,
  productSlug,
} from "@/lib/desapego/model";

const settings = {
  maxListings: 10,
  maxPhotos: 15,
  storageMB: 500,
  categories: DEFAULT_PRODUCT_CATEGORIES.map((category) => ({
    name: category.name,
    subcategories: [...category.subcategories],
  })),
};

const readyListing = {
  title: "Notebook em ótimo estado",
  category: "Computadores e notebooks",
  subcategory: "Notebooks",
  brand: "Marca",
  model: "Modelo 14",
  description: "Notebook conservado, funcionando perfeitamente e pronto para uso.",
  condition: "Usado em ótimo estado",
  price: 2659.75,
  previousPrice: 3000,
  state: "SP",
  city: "São Paulo",
  sellerName: "Joana",
  delivery: "Retirada combinada",
  phone: "11987654321",
  consent: true,
  submit: true,
  imageIds: ["123e4567-e89b-42d3-a456-426614174000"],
};

describe("modelo do Alilu Desapego", () => {
  it("aceita anúncio válido, preço decimal e normaliza o contato para WhatsApp", () => {
    const parsed = parseProduct(readyListing, settings);
    expect(parsed.data.price).toBe(2659.75);
    expect(parsed.data.previousPrice).toBe(3000);
    expect(parsed.phone).toBe("5511987654321");
    expect(parsed.imageIds).toHaveLength(1);
    expect(parsed.submit).toBe(true);
  });

  it("só permite enviar anúncio com consentimento e ao menos uma foto", () => {
    expect(() => parseProduct({ ...readyListing, consent: false }, settings)).toThrow(DesapegoError);
    expect(() => parseProduct({ ...readyListing, imageIds: [] }, settings)).toThrow("Adicione ao menos uma foto");
  });

  it("recusa categoria ou subcategoria fora da configuração", () => {
    expect(() => parseProduct({ ...readyListing, category: "Categoria inexistente" }, settings)).toThrow("categoria válida");
    expect(() => parseProduct({ ...readyListing, subcategory: "Subcategoria inexistente" }, settings)).toThrow("subcategoria válida");
  });

  it("recusa preço com mais de duas casas decimais e preço anterior menor", () => {
    expect(() => parseProduct({ ...readyListing, price: 10.123 }, settings)).toThrow("duas casas decimais");
    expect(() => parseProduct({ ...readyListing, previousPrice: 100 }, settings)).toThrow("maior que o preço atual");
  });

  it("limita fotos e impede IDs duplicados", () => {
    const many = Array.from({ length: 16 }, (_, i) => `123e4567-e89b-42d3-a456-${String(i).padStart(12, "0")}`);
    expect(() => parseProduct({ ...readyListing, imageIds: many }, settings)).toThrow("Fotos inválidas");
    expect(() => parseProduct({ ...readyListing, imageIds: [readyListing.imageIds[0], readyListing.imageIds[0]] }, settings)).toThrow("Fotos inválidas");
  });

  it("normaliza filtros e não aceita valores de página/sort inválidos", () => {
    const filters = parseProductFilters(new URLSearchParams("q=  celular  &min=-1&max=5000&page=0&sort=unsafe&exchange=1"));
    expect(filters).toMatchObject({ q: "celular", min: 0, max: 5000, page: 1, sort: "recent", acceptsExchange: true });
  });

  it("gera slug determinístico com caracteres acentuados normalizados", () => {
    expect(productSlug("Câmera Digital", "São Paulo", "123e4567-e89b-42d3-a456-426614174000"))
      .toBe("camera-digital-sao-paulo-123e4567-e89b-42d3-a456-426614174000");
  });
});
