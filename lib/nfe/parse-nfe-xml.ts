/**
 * Lógica de leitura do XML de uma Nota Fiscal Eletrônica (NF-e), isolada da
 * interface (PROMPT MESTRE, seção 14). O parsing é feito INTEIRAMENTE no
 * navegador com `DOMParser` (nativo, sem dependências) — o arquivo XML
 * nunca é enviado para nenhum servidor (PROMPT MESTRE, "Leitor XML NF-e":
 * "Processar XML LOCALMENTE no navegador", "Não fazer upload").
 *
 * `DOMParser` só INTERPRETA o XML como dados (árvore de elementos/texto) —
 * ele nunca executa scripts nem interpreta o conteúdo como HTML, então não
 * há risco de execução de conteúdo malicioso embutido no arquivo (PROMPT
 * MESTRE: "Não executar conteúdo do XML", "Não interpretar XML como HTML").
 *
 * Extrai apenas os dados úteis realmente presentes no XML (nó `infNFe` do
 * layout padrão da NF-e/SEFAZ): identificação, emitente, destinatário,
 * produtos e totais. Campos ausentes no XML ficam como `null`/lista vazia —
 * nada é inventado.
 */

export interface NfeProduct {
  code: string | null;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  unitValue: number | null;
  totalValue: number | null;
}

export interface NfeParty {
  name: string | null;
  document: string | null;
}

export interface NfeData {
  accessKey: string | null;
  number: string | null;
  series: string | null;
  issueDate: string | null;
  issuer: NfeParty;
  recipient: NfeParty;
  products: NfeProduct[];
  totals: {
    productsValue: number | null;
    icmsValue: number | null;
    ipiValue: number | null;
    invoiceValue: number | null;
  };
}

export type NfeParseError =
  | "empty"
  | "invalid-xml"
  | "not-nfe";

export type NfeParseResult =
  | { ok: true; data: NfeData }
  | { ok: false; error: NfeParseError };

function textOf(parent: Element | Document, tag: string): string | null {
  const element = parent.getElementsByTagName(tag)[0];
  const value = element?.textContent?.trim();
  return value ? value : null;
}

function numberOf(parent: Element | Document, tag: string): number | null {
  const raw = textOf(parent, tag);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parseParty(root: Document, tag: "emit" | "dest"): NfeParty {
  const element = root.getElementsByTagName(tag)[0];
  if (!element) {
    return { name: null, document: null };
  }
  const name = textOf(element, "xNome");
  const document = textOf(element, "CNPJ") ?? textOf(element, "CPF");
  return { name, document };
}

function parseProducts(root: Element | Document): NfeProduct[] {
  const detElements = Array.from(root.getElementsByTagName("det"));
  return detElements.map((det) => {
    const prod = det.getElementsByTagName("prod")[0];
    if (!prod) {
      return {
        code: null,
        description: null,
        quantity: null,
        unit: null,
        unitValue: null,
        totalValue: null,
      };
    }
    return {
      code: textOf(prod, "cProd"),
      description: textOf(prod, "xProd"),
      quantity: numberOf(prod, "qCom"),
      unit: textOf(prod, "uCom"),
      unitValue: numberOf(prod, "vUnCom"),
      totalValue: numberOf(prod, "vProd"),
    };
  });
}

/** Extrai a chave de acesso (44 dígitos) do atributo `Id` de `infNFe` (ex.: "NFe35...44dígitos"). */
function parseAccessKey(infNFe: Element): string | null {
  const id = infNFe.getAttribute("Id");
  if (!id) return null;
  const match = /(\d{44})/.exec(id);
  return match ? match[1] : null;
}

/**
 * Lê e valida o conteúdo de um arquivo XML de NF-e. Retorna um resultado
 * tipado (nunca lança exceção) para que a interface trate cada erro com uma
 * mensagem clara, sem expor detalhes técnicos do parser.
 */
export function parseNfeXml(xmlText: string): NfeParseResult {
  if (!xmlText || xmlText.trim() === "") {
    return { ok: false, error: "empty" };
  }

  let document: Document;
  try {
    const parser = new DOMParser();
    document = parser.parseFromString(xmlText, "application/xml");
  } catch {
    return { ok: false, error: "invalid-xml" };
  }

  // Um XML malformado faz o DOMParser retornar um documento contendo um nó
  // <parsererror> (comportamento padrão do DOM, sem lançar exceção).
  if (document.getElementsByTagName("parsererror").length > 0) {
    return { ok: false, error: "invalid-xml" };
  }

  const infNFe = document.getElementsByTagName("infNFe")[0];
  if (!infNFe) {
    return { ok: false, error: "not-nfe" };
  }

  const ide = infNFe.getElementsByTagName("ide")[0] ?? infNFe;
  const total = infNFe.getElementsByTagName("ICMSTot")[0];

  const data: NfeData = {
    accessKey: parseAccessKey(infNFe),
    number: textOf(ide, "nNF"),
    series: textOf(ide, "serie"),
    issueDate: textOf(ide, "dhEmi") ?? textOf(ide, "dEmi"),
    issuer: parseParty(document, "emit"),
    recipient: parseParty(document, "dest"),
    products: parseProducts(infNFe),
    totals: {
      productsValue: total ? numberOf(total, "vProd") : null,
      icmsValue: total ? numberOf(total, "vICMS") : null,
      ipiValue: total ? numberOf(total, "vIPI") : null,
      invoiceValue: total ? numberOf(total, "vNF") : null,
    },
  };

  return { ok: true, data };
}
