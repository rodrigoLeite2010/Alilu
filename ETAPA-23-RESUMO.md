# ALILU — Resumo da Etapa 23 (implementação concluída)

> Nota: o plano inicial foi rascunhado como "Etapa 17" antes de eu checar
> `ARCHITECTURE.md` — esse número já estava em uso (uma etapa antiga, sobre
> correções de agendamento). Corrigido para **Etapa 23** em todo o código e
> comentários; o plano está em `ETAPA-23-PLANO.md`.

Os 5 pedidos foram implementados na ordem sugerida no plano (4 → 5 → 2 → 3 → 1).
Cada item está documentado em detalhe em `ARCHITECTURE.md`, seção "Etapa 23".

## O que foi feito

1. **Bug do filtro de categoria** ("Ver todos os profissionais" dentro de
   "Piscina" mostrava qualquer profissional) — corrigido, back-end e mobile.
2. **Traduções do admin-web** (papel/status apareciam em inglês) — corrigido
   via `utils/statusLabels.ts`.
3. **Avaliar qualquer profissional pela busca** — `Review.BookingId` agora é
   opcional (avaliação livre), busca por nome adicionada, botão "Avaliar"
   sempre visível no perfil do profissional.
4. **Mural** — módulo novo (décimo módulo do backend): post livre
   (reclamação/sugestão/aviso/prestador não cadastrado), visível na hora,
   síndico/admin pode bloquear depois. Telas no mobile e no admin-web.
5. **Convidar prestador** — novo endpoint que envia WhatsApp (Twilio
   WhatsApp Business API), SMS (fallback via Twilio) e e-mail (Twilio
   SendGrid) para uma pessoa indicada por um morador. **Sem as credenciais
   configuradas, o convite é gravado normalmente mas nenhuma mensagem é
   enviada de verdade — só logada** (mesmo padrão do Expo Push sem token).

## O que você precisa rodar na sua máquina

Este ambiente (sandbox de nuvem) não tem acesso ao `dotnet`/NuGet.org, então
nada aqui foi compilado de verdade — só escrito com muito cuidado, revisado
por leitura, e validado com as ferramentas que EU tinha disponíveis
(`scripts/check-references.py` para a arquitetura do `.sln`, `tsc`/`tsc -b`
para o mobile e o admin-web — todos limpos). Antes de considerar isso pronto:

```bash
cd backend

# 1) build completo
dotnet build

# 2) testes automatizados (novos: Reviews — avaliação livre; Mural — criação,
#    bloqueio, escopo administrativo)
dotnet test

# 3) migração do banco — três mudanças de schema nesta etapa (BookingId
#    opcional + índice novo em Reviews; tabelas novas do módulo Mural;
#    tabela nova de convites no módulo Professional). Pode ser uma única
#    migração:
dotnet ef migrations add Etapa23 --project src/Infrastructure/Alilu.Infrastructure --startup-project src/Api/Alilu.Api
dotnet ef database update --project src/Infrastructure/Alilu.Infrastructure --startup-project src/Api/Alilu.Api
```

Se `dotnet build`/`dotnet test` apontarem algum erro (sempre possível, já
que não pude compilar aqui), me avise com a mensagem de erro exata — eu
corrijo.

## Configuração pendente (para o convite funcionar de verdade)

Em `appsettings.json` (ou variáveis de ambiente/gerenciador de segredos —
nunca direto no arquivo em produção):

```
Twilio__AccountSid=...
Twilio__AuthToken=...
Twilio__WhatsAppFrom=...        # número com WhatsApp Business habilitado no Console da Twilio, já em E.164 (ex.: +17372212163)
Twilio__WhatsAppContentSid=...  # OBRIGATÓRIO para o WhatsApp funcionar — ver nota abaixo
Twilio__SmsFrom=...             # número comum da Twilio, usado como fallback
SendGrid__ApiKey=...
SendGrid__FromEmail=...
```

**Sobre `WhatsAppContentSid`**: mensagem iniciada pela empresa (o prestador
convidado nunca mandou mensagem antes) só é aceita pela Meta via um Content
Template pré-aprovado (Console da Twilio -> Messaging -> Content Template
Builder) — nunca texto livre (`Body`). Sem essa credencial preenchida (junto
com as outras três), o WhatsApp cai automaticamente no sender fake (log),
mesmo que `AccountSid`/`AuthToken`/`WhatsAppFrom` já estejam certos — mais
seguro do que tentar texto livre e a Twilio rejeitar em silêncio.

⚠️ **Sobre o Auth Token compartilhado no chat**: como você colou o
`AccountSid`/`AuthToken` reais numa mensagem aqui, considere esse Auth Token
comprometido — recomendo gerar um novo no Console da Twilio (Account ->
API keys & tokens -> "regenerate secondary token" ou similar) e usar só o
novo a partir daqui. Nunca cole credenciais reais no chat nem no código-fonte
— sempre variável de ambiente ou gerenciador de segredos, como já estava
documentado acima.

**Decisões que ainda são suas** (não são bugs — são escolhas de produto que
deixei documentadas em vez de decidir por você):
- Redação final do texto do convite (hoje é um rascunho em português).
- Limite de 10 convites/dia por morador — número exato a confirmar.
- Mural: os 4 tipos de post (Reclamação/Sugestão/Aviso/Prestador não
  cadastrado) e o fato de só morador ter acesso (sem profissional) — se
  quiser mudar, é uma alteração pequena.

## Correções feitas depois da primeira entrega

- **Dois erros reais de `dotnet build`** que você reportou: escaping
  corrompido em `ReviewConfiguration.cs` (`HasFilter`) e `using` faltando em
  `Program.cs` (`AddMuralModule`) — ambos corrigidos.
- **Tela inicial ainda em inglês** ("Resident/Professional/Administration
  (placeholder)") — era `mobile/src/app/index.tsx`, a tela raiz de navegação,
  que não tinha sido pega na revisão de tradução original. Traduzida para
  "Área do morador" / "Área do prestador" / "Administração (em breve)".
- **Erro "Ocorreu um erro inesperado" ao testar o convite** — causa: a
  migração desta etapa (tabelas de convite e do Mural) ainda não tinha sido
  gerada/aplicada. Não é bug de código; é o passo de `dotnet ef migrations
  add Etapa23` / `dotnet ef database update` acima, que só você consegue
  rodar (este sandbox não tem `dotnet`).
- **WhatsApp via Content Template** — o envio original usava texto livre
  (`Body`), que a Meta rejeita para mensagem iniciada pela empresa. Reescrito
  para usar `ContentSid` (confirmado por você com uma chamada real
  funcionando) — ver `Twilio__WhatsAppContentSid` acima.
- **Telefone sem "+55"** — a tela pede só "Telefone (com DDD)" (ex.:
  "11987930848"), mas a Twilio exige E.164 (`+5511987930848`) em ambos os
  canais (WhatsApp e SMS). Adicionada uma normalização automática
  (`BrazilianPhoneNumberFormatter`) antes de qualquer chamada à Twilio — o
  valor digitado pelo morador continua sendo o que fica gravado/exibido no
  histórico de convites, só a cópia enviada à Twilio é reformatada.

## Verificação que EU consegui fazer

- `scripts/check-references.py`: 43 projetos, sem dependência circular, sem
  violação de módulo — passou depois de cada mudança estrutural no `.sln`.
- `mobile`: `npx tsc --noEmit` limpo.
- `admin-web`: `npx tsc -b` limpo.
- Todo o `Alilu.sln` reconferido linha a linha (GUIDs novos, blocos
  `Project`/`EndProject`/`GlobalSection` balanceados).

O que EU não consegui fazer (mesma limitação de sempre neste sandbox): nada
de C# foi de fato compilado (`dotnet build`) nem testado (`dotnet test`), e
nenhuma chamada real foi feita à Twilio/SendGrid.
