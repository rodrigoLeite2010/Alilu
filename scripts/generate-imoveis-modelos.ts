// Gera os arquivos-modelo para parceiros em public/imoveis/modelos.
// Uso: npx tsx scripts/generate-imoveis-modelos.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATE_COLUMNS, TEMPLATE_EXAMPLE } from "../lib/imoveis/integracoes/fields";
import { buildXlsx, toCsv } from "../lib/imoveis/integracoes/parsers";

const dir = join(process.cwd(), "public", "imoveis", "modelos");
mkdirSync(dir, { recursive: true });

const second = {
  ...TEMPLATE_EXAMPLE,
  CodigoImovel: "APT-204",
  Titulo: "Apartamento 2 dormitórios no Jardim Aquarius",
  Descricao: "Apartamento com 2 dormitórios, varanda gourmet, 1 vaga e lazer completo no condomínio. Dados fictícios para teste.",
  Tipo: "Apartamento",
  Finalidade: "Aluguel",
  Valor: "3200,00",
  Condominio: "780,00",
  IPTU: "1200,00",
  Bairro: "Jardim Aquarius",
  Quartos: "2",
  Suites: "1",
  Banheiros: "2",
  Vagas: "1",
  AreaUtil: "68",
  AreaTotal: "68",
  Caracteristicas: "Piscina; Área de lazer; Aceita animais",
  Fotos: "https://parceiro.example/imagens/APT-204-1.jpg",
  LinkOriginal: "https://parceiro.example/imovel/APT-204",
};
const rows = [[...TEMPLATE_COLUMNS], TEMPLATE_COLUMNS.map((c) => TEMPLATE_EXAMPLE[c]), TEMPLATE_COLUMNS.map((c) => second[c])];
const help = [
  ["Coluna", "Obrigatória", "Formato / observações"],
  ["CodigoImovel", "Sim", "Código único e estável do imóvel no sistema do parceiro. Nunca reutilize códigos."],
  ["Titulo", "Não", "10 a 120 caracteres. Se vazio, é gerado a partir do tipo e bairro."],
  ["Descricao", "Recomendada", "Texto autorizado para divulgação. HTML é removido. Não inclua dados pessoais."],
  ["Tipo", "Sim", "Casa, Apartamento, Terreno, Chácara, Cobertura, Kitnet, Sala comercial, Galpão ou Outro."],
  ["Finalidade", "Sim", "Venda, Aluguel ou Temporada."],
  ["Valor", "Sim", "Em reais. Aceita 850000, 850.000,00 ou 850000.00."],
  ["Condominio / IPTU", "Não", "Em reais (condomínio mensal, IPTU anual)."],
  ["Cidade / Estado / Bairro", "Sim", "Estado pela sigla (SP) ou nome (São Paulo)."],
  ["Quartos / Suites / Banheiros / Vagas", "Não", "Números inteiros."],
  ["AreaUtil / AreaTotal", "AreaTotal ou AreaUtil", "Em m². Se só houver área útil, ela é usada como área total."],
  ["Endereco / CEP / Latitude / Longitude", "Não", "PRIVADOS: nunca são exibidos no site; usados só para detectar duplicidades."],
  ["Caracteristicas", "Não", "Separadas por ponto e vírgula. Ex.: Piscina; Churrasqueira; Mobiliado."],
  ["Fotos", "Recomendada", "URLs https separadas por | (barra vertical). Somente de domínios autorizados. Máximo 20."],
  ["LinkOriginal", "Recomendada", "URL https do anúncio no site do parceiro."],
  ["WhatsAppComercial", "Não", "Somente se o parceiro autorizou contato por anúncio. Caso contrário, usa-se o WhatsApp comercial do cadastro."],
  ["Status", "Não", "Ativo, Inativo, Vendido ou Alugado. Vazio = Ativo."],
];
async function main() {
  writeFileSync(join(dir, "MODELO_IMPORTACAO_IMOVEIS.xlsx"), await buildXlsx([{ name: "Imoveis", rows }, { name: "Instrucoes", rows: help }]));
  writeFileSync(join(dir, "MODELO_IMPORTACAO_IMOVEIS.csv"), toCsv(rows));
  const json = {
    imoveis: [
      {
        codigo: "ABC123",
        titulo: "Casa com 3 dormitórios",
        descricao: "Casa térrea com 3 dormitórios, sendo 1 suíte, quintal e churrasqueira. Dados fictícios para teste.",
        cidade: "São José dos Campos",
        estado: "SP",
        bairro: "Urbanova",
        tipo: "Casa",
        finalidade: "Venda",
        preco: 850000,
        quartos: 3,
        suites: 1,
        banheiros: 2,
        vagas: 2,
        area: 180,
        caracteristicas: ["Churrasqueira", "Área de lazer"],
        urlOriginal: "https://parceiro.example/imovel/ABC123",
        imagens: ["https://parceiro.example/imagens/ABC123-1.jpg", "https://parceiro.example/imagens/ABC123-2.jpg"],
      },
      {
        codigo: "APT-204",
        titulo: "Apartamento 2 dormitórios no Jardim Aquarius",
        descricao: "Apartamento com varanda gourmet e lazer completo. Dados fictícios para teste.",
        cidade: "São José dos Campos",
        estado: "SP",
        bairro: "Jardim Aquarius",
        tipo: "Apartamento",
        finalidade: "Aluguel",
        preco: 3200,
        condominio: 780,
        quartos: 2,
        banheiros: 2,
        vagas: 1,
        area: 68,
        caracteristicas: ["Piscina"],
        urlOriginal: "https://parceiro.example/imovel/APT-204",
        imagens: [{ url: "https://parceiro.example/imagens/APT-204-1.jpg", ordem: 1 }],
      },
    ],
  };
  writeFileSync(join(dir, "EXEMPLO_IMPORTACAO_IMOVEIS.json"), JSON.stringify(json, null, 2) + "\n");
  // Estrutura baseada no formato público VRSync (ListingDataFeed). Confirme sempre
  // com um arquivo real do parceiro: versões e campos variam entre fornecedores.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed xmlns="http://www.vivareal.com/schemas/1.0/VRSync" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Header>
    <Provider>Imobiliária Exemplo (dados fictícios)</Provider>
    <Email>contato@parceiro.example</Email>
    <ContactName>Responsável Exemplo</ContactName>
  </Header>
  <Listings>
    <Listing>
      <ListingID>ABC123</ListingID>
      <Title><![CDATA[Casa com 3 dormitórios no Urbanova]]></Title>
      <TransactionType>For Sale</TransactionType>
      <PublicationType>STANDARD</PublicationType>
      <DetailViewUrl>https://parceiro.example/imovel/ABC123</DetailViewUrl>
      <Media>
        <Item medium="image" caption="Fachada" primary="true">https://parceiro.example/imagens/ABC123-1.jpg</Item>
        <Item medium="image" caption="Sala">https://parceiro.example/imagens/ABC123-2.jpg</Item>
        <Item medium="video">https://www.youtube.com/watch?v=dQw4w9WgXcQ</Item>
      </Media>
      <Details>
        <PropertyType>Residential / Home</PropertyType>
        <Description><![CDATA[Casa térrea com 3 dormitórios, sendo 1 suíte.<br>Quintal com churrasqueira. Dados fictícios para teste.]]></Description>
        <ListPrice currency="BRL">850000</ListPrice>
        <PropertyAdministrationFee currency="BRL">0</PropertyAdministrationFee>
        <YearlyTax currency="BRL">2400</YearlyTax>
        <LivingArea unit="square metres">180</LivingArea>
        <LotArea unit="square metres">250</LotArea>
        <Bedrooms>3</Bedrooms>
        <Bathrooms>2</Bathrooms>
        <Suites>1</Suites>
        <Garage type="Parking Space">2</Garage>
        <Features>
          <Feature>BBQ</Feature>
          <Feature>Gourmet Area</Feature>
        </Features>
      </Details>
      <Location displayAddress="Neighborhood">
        <Country abbreviation="BR">Brasil</Country>
        <State abbreviation="SP">São Paulo</State>
        <City>São José dos Campos</City>
        <Neighborhood>Urbanova</Neighborhood>
        <Address>Rua Exemplo</Address>
        <StreetNumber>100</StreetNumber>
        <PostalCode>12244000</PostalCode>
      </Location>
      <ContactInfo>
        <Name>Imobiliária Exemplo</Name>
        <Email>contato@parceiro.example</Email>
        <Telephone>(12) 3333-0000</Telephone>
      </ContactInfo>
    </Listing>
    <Listing>
      <ListingID>APT-204</ListingID>
      <Title>Apartamento 2 dormitórios no Jardim Aquarius</Title>
      <TransactionType>For Rent</TransactionType>
      <DetailViewUrl>https://parceiro.example/imovel/APT-204</DetailViewUrl>
      <Media>
        <Item medium="image" primary="true">https://parceiro.example/imagens/APT-204-1.jpg</Item>
      </Media>
      <Details>
        <PropertyType>Residential / Apartment</PropertyType>
        <Description>Apartamento com varanda gourmet, 1 vaga e lazer completo no condomínio. Dados fictícios para teste.</Description>
        <RentalPrice currency="BRL" period="Monthly">3200</RentalPrice>
        <PropertyAdministrationFee currency="BRL">780</PropertyAdministrationFee>
        <LivingArea unit="square metres">68</LivingArea>
        <Bedrooms>2</Bedrooms>
        <Bathrooms>2</Bathrooms>
        <Suites>1</Suites>
        <Garage type="Parking Space">1</Garage>
        <Features>
          <Feature>Pool</Feature>
          <Feature>Pets Allowed</Feature>
        </Features>
      </Details>
      <Location displayAddress="Neighborhood">
        <Country abbreviation="BR">Brasil</Country>
        <State abbreviation="SP">São Paulo</State>
        <City>São José dos Campos</City>
        <Neighborhood>Jardim Aquarius</Neighborhood>
      </Location>
    </Listing>
  </Listings>
</ListingDataFeed>
`;
  writeFileSync(join(dir, "EXEMPLO_IMPORTACAO_IMOVEIS.xml"), xml);
  console.log("Modelos gerados em", dir);
}
main();
