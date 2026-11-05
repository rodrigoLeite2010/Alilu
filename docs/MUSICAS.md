# Alilu Músicas

O menu **Músicas** dá acesso à biblioteca privada, aos repertórios e às sessões ao vivo. A biblioteca pesquisa por título, artista ou estilo e mantém a origem da cifra e as preferências da música. O editor salva automaticamente, indica conflitos de revisão e mostra uma prévia de letra, acordes e seções. Na biblioteca e no palco, a transposição altera a raiz e o baixo das inversões e preserva a letra.

O importador recebe texto colado, TXT, ChordPro e PDF com texto selecionável. O PDF é processado no navegador e a prévia permite corrigir o alinhamento antes de salvar. É possível selecionar até 15 arquivos, com até 30 músicas por lote. Exportações de repertório em ChordPro incluem a ordem das músicas e as cifras originais. Links externos são referências. A consulta aos termos do Cifra Club não identificou acesso autorizado para importação automatizada. [Termos do Cifra Club](https://www.cifraclub.com.br/aviso-legal.html) · [Referência ChordPro](https://www.chordpro.org/beta/chordpro-cheat_sheet/)

Os repertórios têm notas, ordem editável por arrastar ou por botões, tom e velocidade por faixa, duplicação e exportação. No ensaio, a rolagem é local. Na apresentação, o palco exibe uma cópia do repertório capturada na abertura da sessão. Espaço inicia ou pausa. As setas esquerda e direita trocam a música. Home reinicia. O navegador pode manter a tela ligada quando oferece Wake Lock.

## Dados e arquivos

| Local | Responsabilidade |
| --- | --- |
| `app/musicas/page.tsx` e `app/musicas/palco/page.tsx` | Biblioteca, repertórios, sessões e palco com login obrigatório |
| `app/api/musicas/route.ts` | API privada com Auth.js, validação de origem, respostas sem cache e limite de corpo |
| `components/music/` | Biblioteca, editor, prévia, repertórios e palco |
| `lib/music/` | Conversão, transposição, relógio da rolagem, validação e acesso a dados |
| `db/migrations/0051_music.sql` | Migração aditiva |
| `components/navigation/SiteNav.tsx` | Entrada no menu principal |
| `__tests__/music/` | Conversão e transposição, persistência e isolamento em PGlite, testes do palco |

A migração cria `music_songs` e `music_sets` com dono, revisão e conteúdo JSONB. Os itens do repertório são armazenados em ordem no mesmo documento, com ID estável e preferências por faixa. `music_live` guarda sessão, cópia do programa, líder, estado, versão e validade. `music_live_devices` associa conta e dispositivo à sessão. `music_quotas` limita operações de escrita, presença e tentativas de ingresso por conta. Encerrar a sessão remove a cópia das cifras. Excluir uma música encerra sessões que contêm cópias dela. Retire a faixa excluída de cada repertório antes de reabrir o palco.

## Sincronização e custo

O módulo usa a API HTTP da Vercel e o Neon que já atende o Alilu. A cada 1,25 segundo em primeiro plano, cada tela consulta faixa, posição normalizada, velocidade, versão e horário de referência. A tela anima localmente e ajusta a posição conforme o relógio estimado do servidor. O intervalo aumenta quando a aba está oculta ou há falhas de rede. A primeira resposta inclui a cópia do repertório. As consultas seguintes carregam só o estado. O atraso depende do intervalo de consulta, da rede e do navegador.

Convidados entram com a própria conta usando código, link ou QR Code. Cada nova aba se registra como outro dispositivo. Um novo acesso do dono entra como seguidor e pode assumir o controle explicitamente. O líder pode transferir o controle a outro dispositivo presente. A versão do estado protege contra comandos atrasados e alterações concorrentes. Sessões aceitam até 100 registros de dispositivo e expiram após 12 horas.

Sem novas dependências npm ou mensalidade de provedor adicional. O consumo em primeiro plano é de aproximadamente 3 mil chamadas por tela por hora, incluindo presença. Seis telas em uma hora geram cerca de 18 mil chamadas. O custo incremental depende das franquias e do consumo de Functions e de compute do Postgres, inclusive tempo de banco ativo durante apresentações. [Preços do Neon](https://neon.com/pricing) · [WebSockets e estado compartilhado na Vercel](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)

## Homologação e publicação

1. Configure um banco Neon de homologação em `DATABASE_URL` no ambiente Preview e mantenha as variáveis Auth.js e o provedor de login já usados no Alilu. O módulo não exige novas variáveis.
2. Confira o destino de `DATABASE_URL` e rode `npm run db:migrate` para aplicar as migrações pendentes no banco de homologação. O build não aplica migrações.
3. Rode `npm test -- __tests__/music` e `npm run build`. Abra o Preview por HTTPS para testar também área de transferência, tela cheia e Wake Lock conforme o dispositivo.
4. Importe um TXT e um ChordPro autorizados, organize o repertório e experimente o ensaio. Abra uma sessão e valide com dois dispositivos físicos, incluindo um tablet em paisagem. Use uma segunda conta para entrar pelo QR Code e uma segunda aba da conta do líder. Confira os dois modos de espelhamento, avance uma faixa, transfira o controle, desconecte e reconecte um seguidor e encerre a sessão.
5. Após validar o Preview, aplique a migração aditiva com a rotina de release do projeto e publique o build. A migração pode ficar no banco se for preciso reverter o build.

A implementação cobre acordes e as principais diretivas de metadados e seções do ChordPro. Diagramas, tablaturas, macros avançadas, OCR, cache offline persistente e exportação em PDF estão fora desta entrega. A perda temporária de conexão mantém o conteúdo aberto e a tela retoma o estado do líder ao reconectar.

## Verificações locais

- Testes automatizados com Postgres em memória para edição, ordem, isolamento de contas, autorização por dispositivo, controle concorrente e transferência de liderança.
- Testes de interface para duas velocidades, pausa, avanço automático, espelhamento de faixa, sincronização de posição e retomada após reconexão.
- Chrome com três contextos isolados de 1440 × 900, 1024 × 600 e 390 × 844. A interface foi exercitada com respostas simuladas da API. No navegador, também foram testados seleção, prévia e envio em lote de arquivos TXT e ChordPro.
- A validação integrada de Auth.js, Neon hospedado e aparelhos físicos deve ser feita no ambiente Preview. A política local bloqueou a inicialização do servidor Next com o adaptador de banco de teste.
