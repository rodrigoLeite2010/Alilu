# Matriz de Viabilidade - Ferramentas PDF

Esta matriz registra as decisões técnicas da expansão da categoria PDF. A
categoria só publica ferramentas com processamento real e testado; as demais
ficam com status `em-breve`, `noindex, follow` e fora do sitemap até que a
tecnologia necessária esteja disponível.

| Ferramenta | Estado nesta etapa | Execução | Base técnica | Limitação ou bloqueio |
| --- | --- | --- | --- | --- |
| Unir PDF | Publicada | Navegador | pdf-lib | Não preserva assinaturas digitais válidas ou formulários interativos. |
| Dividir PDF | Publicada | Navegador | pdf-lib, JSZip | Cria PDFs por página ou um documento com páginas escolhidas. |
| Girar PDF | Publicada | Navegador | pdf-lib | A rotação altera a orientação das páginas, não o conteúdo original. |
| JPG para PDF | Publicada | Navegador | pdf-lib | Aceita JPG/JPEG e preserva proporção sem recorte automático. |
| PDF para JPG | Publicada | Navegador | PDF.js, JSZip | Renderiza páginas; não extrai imagens internas do PDF. |
| Marca d'água | Publicada | Navegador | pdf-lib | Adiciona texto ou imagem por cima do conteúdo existente. |
| Comprimir PDF | Em breve | Navegador ou servidor | A definir | Reempacotar um PDF não garante redução; níveis reais exigem reamostragem/otimização controlada. |
| Editar PDF | Em breve | Navegador | PDF.js e pdf-lib | Exige superfície de edição, coordenadas e histórico de alterações antes de ser publicada. |
| Assinar PDF | Em breve | Navegador | PDF.js e pdf-lib | Uma assinatura visual não substitui assinatura digital criptográfica. |
| Proteger PDF | Em breve | A definir | Biblioteca de criptografia PDF compatível | pdf-lib não criptografa documentos existentes. Nenhum mecanismo de proteção será simulado. |
| Desbloquear PDF | Em breve | A definir | Biblioteca de criptografia PDF compatível | Só pode aceitar senha fornecida; não haverá quebra de senha ou força bruta. |
| Word para PDF | Em breve | Servidor | Renderizador Office isolado | Conversão fiel de DOC/DOCX requer mecanismo de renderização Office; não há backend autorizado. |
| PowerPoint para PDF | Em breve | Servidor | Renderizador Office isolado | PPT/PPTX precisa de renderizador que preserve slides, gráficos e fontes. |
| Excel para PDF | Em breve | Servidor | Renderizador Office isolado | XLS/XLSX exige paginação e impressão de planilha reais. |
| PDF para Word | Em breve | Servidor | Parser e conversor de estrutura | Não será entregue como imagens dentro de DOCX fingindo editabilidade. |
| PDF para PowerPoint | Em breve | Navegador ou servidor | A definir | Uma versão visual baseada em páginas como imagem precisa ser explicitamente separada de elementos editáveis. |
| PDF para Excel | Em breve | Navegador ou servidor | Detector de tabelas | PDFs digitalizados, tabelas sem borda e layouts complexos exigem validação humana. |
| HTML para PDF | Em breve | Navegador ou servidor | A definir | URL pública exigiria backend isolado e proteção contra SSRF; sem isso a ferramenta não acessará URLs. |

## Dependências desta etapa

- `pdf-lib` 1.17.1 - MIT. Manipulação e criação local de PDFs.
- `pdfjs-dist` 6.3.289 - Apache-2.0. Renderização local de páginas para JPG e prévias.
- `jszip` 3.10.2 - MIT (licença dual MIT ou GPL-3.0-or-later; o projeto usa a opção MIT). Empacotamento local de múltiplos downloads.

Nenhuma ferramenta desta etapa envia documentos, nomes de arquivos ou conteúdo
para servidores, APIs externas, analytics ou armazenamento persistente.
