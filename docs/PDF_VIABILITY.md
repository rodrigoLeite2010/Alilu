# Matriz de Viabilidade - Ferramentas PDF

Esta matriz registra as decisões técnicas da categoria PDF. Todas as
ferramentas listadas abaixo executam processamento real e local no navegador:
o ALILU não envia documentos, nomes de arquivos, senhas ou conteúdo para APIs,
servidores externos, analytics ou armazenamento persistente.

Cada conversão publicada descreve suas limitações na própria tela. Um arquivo
Office ou PDF pode conter recursos proprietários que não existem no navegador;
por isso, o catálogo não afirma fidelidade, OCR, redação permanente ou
assinatura digital quando esses recursos não são produzidos.

| Ferramenta | Estado | Execução | Base técnica | Limitação declarada |
| --- | --- | --- | --- | --- |
| Unir PDF | Publicada | Navegador | pdf-lib | Não preserva assinaturas digitais válidas ou formulários interativos. |
| Dividir PDF | Publicada | Navegador | pdf-lib, JSZip | Cria PDFs por página ou um documento com páginas escolhidas. |
| Girar PDF | Publicada | Navegador | pdf-lib | A rotação altera a orientação das páginas, não o conteúdo original. |
| JPG para PDF | Publicada | Navegador | pdf-lib | Aceita JPG/JPEG e preserva proporção sem recorte automático. |
| PDF para JPG | Publicada | Navegador | PDF.js, JSZip | Renderiza páginas; não extrai imagens internas do PDF. |
| Marca d'água | Publicada | Navegador | pdf-lib | Adiciona texto ou imagem por cima do conteúdo existente. |
| Comprimir PDF | Publicada | Navegador | PDF.js, pdf-lib | Recria páginas como imagens; pode não reduzir arquivos já otimizados e não preserva texto pesquisável, campos ou assinaturas digitais. |
| Editar PDF | Publicada | Navegador | pdf-lib | Adiciona texto ou retângulos visuais. Retângulos não removem o conteúdo original de forma irreversível. |
| Assinar PDF | Publicada | Navegador | Canvas, pdf-lib | Cria assinatura visual digitada, desenhada ou em imagem; não é assinatura digital certificada. |
| Proteger PDF | Publicada | Navegador | @pdfsmaller/pdf-encrypt | Usa AES-256 para senha de abertura. Permissões de cópia/impressão exigem senha de proprietário e dependem do leitor respeitá-las. |
| Desbloquear PDF | Publicada | Navegador | @pdfsmaller/pdf-decrypt | Só aceita senha informada e autorizada; não tenta recuperar senha. AES-256 e RC4 são compatíveis; AES-128 pode não ser. |
| Word para PDF | Publicada | Navegador | Mammoth, DOMPurify, html2canvas, pdf-lib | Aceita DOCX e renderiza texto/tabelas. Layout avançado do Word pode variar. |
| PowerPoint para PDF | Publicada | Navegador | JSZip, pdf-lib | Aceita PPTX e extrai texto/imagens compatíveis. Animações, gráficos e posicionamento exato não são reproduzidos. |
| Excel para PDF | Publicada | Navegador | JSZip, pdf-lib | Aceita XLSX e organiza células em tabelas. Fórmulas usam valor salvo; macros, gráficos e estilos complexos não são executados. |
| PDF para Word | Publicada | Navegador | PDF.js, docx | Cria DOCX editável a partir de texto selecionável. PDFs digitalizados não recebem OCR. |
| PDF para PowerPoint | Publicada | Navegador | PDF.js, PptxGenJS | Cria um slide visual por página; elementos internos não ficam editáveis. |
| PDF para Excel | Publicada | Navegador | PDF.js, JSZip | Infere linhas e colunas pelo posicionamento do texto; tabelas complexas pedem revisão. |
| HTML para PDF | Publicada | Navegador | DOMPurify, html2canvas, pdf-lib | Aceita somente HTML colado localmente. Scripts, URLs, conteúdo remoto e estilos externos são removidos. |

## Limites de processamento

- PDF: até 50 MB por arquivo e, nas ferramentas de renderização ou extração,
  até 50 páginas por processamento.
- Office: até 20 MB por arquivo, até 60 MB de conteúdo descompactado e até
  50 slides na conversão de PPTX.
- HTML: até 250 mil caracteres e 20 páginas A4 renderizadas.
- Imagem de assinatura: até 5 MB, somente PNG ou JPG.

Os limites reduzem risco de falta de memória em celulares e computadores menos
potentes. Eles são aplicados antes de abrir o conteúdo do arquivo sempre que o
formato permitir.

## Dependências usadas nesta etapa

- `pdf-lib` 1.17.1 - MIT. Manipulação e criação local de PDFs.
- `pdfjs-dist` 6.3.289 - Apache-2.0. Renderização local e extração de texto.
- `jszip` 3.10.2 - MIT. Leitura e criação de pacotes Office e ZIP.
- `docx` 9.7.1 - MIT. Geração de documentos DOCX no navegador.
- `mammoth` 1.12.3 - BSD-2-Clause. Interpretação de DOCX em HTML semântico.
- `dompurify` 3.4.15 - MPL-2.0 ou Apache-2.0. Sanitização de HTML local.
- `html2canvas` 1.4.1 - MIT. Renderização visual de HTML local.
- `pptxgenjs` 4.0.1 - MIT. Criação de apresentações PPTX no navegador.
- `@pdfsmaller/pdf-encrypt` 1.2.0 e `@pdfsmaller/pdf-decrypt` 1.0.1 - MIT.
  Proteção e remoção de senha compatíveis com Web Crypto.

O `package.json` fixa a resolução de `image-size` 2.0.4 para a dependência
transitiva de PptxGenJS, evitando as versões vulneráveis indicadas pelo audit
do npm.
