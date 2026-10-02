# E-mail transacional (Resend)

Todo e-mail do Alilu sai por **um único serviço**: `lib/email/email-service.ts` (`sendEmail`). Ele:

- usa o provedor Resend (`lib/email/providers/resend-provider.ts`), atrás da interface `EmailProvider`, que pode ser trocada;
- grava cada envio em `email_delivery_logs`, **só com metadados** (tipo, destinatário, status, id do provedor). Nunca guarda o conteúdo nem o código de login;
- respeita a lista de supressão (`email_suppressions`). O código de login e o teste do admin ignoram a supressão, porque a pessoa está pedindo agora;
- repassa a **Idempotency-Key** ao Resend (lembretes usam `agenda-reminder/<id>`, assim não há e-mail duplicado mesmo se o cron repetir).

| Tipo (`email_type`) | Quando | Template |
|---|---|---|
| `LOGIN_CODE` | Entrar com código por e-mail | `lib/email/templates/login-code.ts` |
| `AGENDA_REMINDER` | Lembrete de compromisso | `lib/email/templates/agenda.ts` |
| `AGENDA_CHANGED` / `AGENDA_CANCELLED` | Reservados (hoje não são enviados: quem altera é o próprio usuário) | `lib/email/templates/agenda.ts` |
| `ADMIN_TEST` | Botão "Enviar e-mail de teste" em `/admin/emails` | `lib/email/templates/agenda.ts` |

Status em `email_delivery_logs`: `SENDING` → `QUEUED` (aceito pelo Resend) → `SENT` / `DELIVERED` / `DELAYED` / `BOUNCED` / `COMPLAINED` / `FAILED` (vindos do webhook). `ERROR` significa que o Resend recusou na hora. `SUPPRESSED` significa que o envio não foi feito por causa da supressão.

## Login por código (o que mudou)

- O código continua com 6 dígitos, guardado **só como hash** e com uso único.
- Validade: `LOGIN_CODE_EXPIRATION_MINUTES` (padrão 10, máximo 60). Limite de 5 tentativas por código.
- Novo: só um código ativo por e-mail (pedir outro invalida o anterior). Também há espera de **60 s** entre pedidos, **5 pedidos por hora** por e-mail e **20 por hora** por IP.
- O código nunca vai para logs. Se o envio falhar, a tela mostra uma mensagem genérica.
- O login com Google não foi alterado.

## Passo a passo de configuração

### 1. Conta e domínio

1. Crie a conta em <https://resend.com>.
2. Vá em **Domains → Add Domain**. O Resend recomenda um **subdomínio** para isolar a reputação de envio, por exemplo `mail.alilu.com.br`. O domínio raiz `alilu.com.br` também funciona.
3. Escolha a região (ex.: `sa-east-1`, São Paulo).
4. O painel mostra os registros DNS que você precisa criar. Normalmente são um **TXT de SPF**, um **MX** (para retorno de bounces) e um **TXT de DKIM** (`resend._domainkey…`).
   - **Copie exatamente o que aparecer no painel** no seu provedor de DNS (Registro.br, Cloudflare, Vercel DNS…).
   - Nada é alterado automaticamente.
   - Não apague registros MX/SPF que já existam para o e-mail do domínio raiz.
5. Recomendado: crie um **DMARC** começando em modo só observação:

   | Nome | Tipo | Valor |
   |---|---|---|
   | `_dmarc.alilu.com.br` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc@alilu.com.br;` |

   Depois de semanas entregando bem, você pode endurecer para `quarantine`/`reject`. Se já existir um `_dmarc`, mantenha o existente.
6. Clique em **Verify** e espere o status **Verified**. A propagação do DNS pode levar de minutos a horas.

### 2. API key (permissão mínima)

1. Vá em **API Keys → Create API Key**.
2. Em **Permission**, escolha **Sending access**. **Não use Full access.**
3. Em **Domain**, restrinja ao domínio verificado.
4. Copie a chave. Ela aparece só uma vez.
5. Guarde a chave **somente** nas Environment Variables da Vercel. Nunca no código, em `appsettings`, no frontend ou em logs.

### 3. Webhook (status de entrega e bounces)

1. Vá em **Webhooks → Add Endpoint**.
2. Em URL, informe `https://alilu.com.br/api/webhooks/resend`.
3. Em Events, marque `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed` e `email.suppressed`.
4. Copie o **Signing secret** (`whsec_…`) para `RESEND_WEBHOOK_SECRET`.

Como o webhook se protege:

- Toda requisição é validada pela assinatura (cabeçalhos `svix-id`, `svix-timestamp` e `svix-signature`) com `resend.webhooks.verify`. Sem assinatura válida, a resposta é **401** e nada é gravado.
- **Idempotência**: o `svix-id` fica em `email_webhook_events`, e o mesmo evento repetido é ignorado (`duplicate`). Se o processamento falhar, o registro é desfeito e a resposta é 500, para o Resend tentar de novo.
- Os bounces viram supressão:
  - **bounce permanente** ou **spam**: o endereço vai para `email_suppressions` na hora;
  - **bounce temporário**: 3 ou mais em 30 dias também suprimem o endereço.

### 4. Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Obrigatória | Exemplo / observação |
|---|---|---|
| `RESEND_API_KEY` | sim | `re_…` (Sending access, restrita ao domínio) |
| `EMAIL_FROM` | sim* | `Alilu <nao-responda@mail.alilu.com.br>`. *Se vazia, usa `RESEND_FROM_EMAIL` (nome antigo, ainda aceito) |
| `EMAIL_REPLY_TO` | não | `contato@alilu.com.br` |
| `RESEND_WEBHOOK_SECRET` | sim, para o webhook | `whsec_…` |
| `LOGIN_CODE_EXPIRATION_MINUTES` | não | padrão `10` |
| `ADMIN_EMAILS` | já existe | quem pode abrir `/admin/emails` |

O remetente precisa ser do domínio verificado. Depois de salvar as variáveis, faça um **Redeploy**.

### 5. Banco

Rode `npm run db:migrate`, que aplica `db/migrations/0024_email_and_agenda.sql`.

### 6. Teste em produção

1. Abra `/admin/emails` logado com um e-mail de `ADMIN_EMAILS`. O topo deve mostrar "Envio: configurado" e "Webhook: configurado".
2. Clique em **Enviar e-mail de teste**. O teste vai para o seu próprio e-mail.
3. Em poucos segundos, o contador "Entregues" sobe, porque o webhook chegou. No Resend, em **Emails**, o envio aparece como *Delivered*.
4. Saia da conta e entre com **código por e-mail**. O código deve chegar com o assunto "Seu código de acesso ao Alilu".
5. Crie um compromisso na Agenda para daqui a uns 15 minutos, com lembrete de 10 minutos antes, e confira se o lembrete chega.
6. Opcional: no Resend, em **Webhooks → seu endpoint**, use **Send test event** e confira que a resposta é 200. Uma assinatura errada daria 401.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| "Não foi possível enviar o código" no login | `RESEND_API_KEY` ou `EMAIL_FROM` ausentes, ou domínio ainda não verificado. Confira o log `scope: "email"` na Vercel e `/admin/emails` › Últimos erros |
| Erro `validation_error` / domínio | `EMAIL_FROM` com domínio diferente do verificado |
| Webhook sempre 401 | `RESEND_WEBHOOK_SECRET` errado, ou de outro endpoint |
| Lembretes não chegam para alguém | O endereço está em Supressões (bounce/spam), ou a pessoa desligou os lembretes nas preferências da Agenda |
| `rate_limit_exceeded` | O Resend limita requisições por segundo. O lembrete é reenviado sozinho (1, 5 e 15 min) |
